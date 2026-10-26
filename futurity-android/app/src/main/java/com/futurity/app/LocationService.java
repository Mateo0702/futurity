package com.futurity.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import android.webkit.CookieManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LocationService extends Service {
    private static final String TAG = "LocationService";
    private static final int NOTIFICATION_ID = 1001;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private ExecutorService executorService;
    private PowerManager.WakeLock wakeLock;

    private String idVisita = "";
    private String serverUrl = "";
    private String tecnicoNombre = "";
    private String authToken = "";
    private String deviceId = "";
    private String deviceModel = "";
    private String versionApp = "1.2.0";

    private LocationManager locationManager;
    private LocationListener nativeLocationListener;

    @Override
    public void onCreate() {
        super.onCreate();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        executorService = Executors.newSingleThreadExecutor();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                for (Location location : locationResult.getLocations()) {
                    if (location != null) {
                        Log.d(TAG, "Location updated (Fused): " + location.getLatitude() + ", " + location.getLongitude());
                        postLocation(location);
                    }
                }
            }
        };

        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        nativeLocationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (location != null) {
                    Log.d(TAG, "Location updated (LocationManager): " + location.getLatitude() + ", " + location.getLongitude());
                    postLocation(location);
                }
            }
            @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
            @Override public void onProviderEnabled(String provider) {}
            @Override public void onProviderDisabled(String provider) {}
        };

        createNotificationChannel();

        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && wakeLock == null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Futurity:LocationServiceWakeLock");
                wakeLock.acquire();
                Log.d(TAG, "PARTIAL_WAKE_LOCK acquired for continuous background tracking");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error acquiring WakeLock: " + e.getMessage());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String newVisita = intent.getStringExtra("id_visita");
            if (newVisita != null) idVisita = newVisita;

            String newServer = intent.getStringExtra("server_url");
            if (newServer != null && !newServer.isEmpty()) serverUrl = newServer;

            String newTecnico = intent.getStringExtra("tecnico_nombre");
            if (newTecnico != null && !newTecnico.isEmpty()) tecnicoNombre = newTecnico;

            String newAuth = intent.getStringExtra("auth_token");
            if (newAuth != null && !newAuth.isEmpty()) authToken = newAuth;

            String newDevId = intent.getStringExtra("device_id");
            if (newDevId != null && !newDevId.isEmpty()) deviceId = newDevId;

            String newModel = intent.getStringExtra("device_model");
            if (newModel != null && !newModel.isEmpty()) deviceModel = newModel;

            String newVer = intent.getStringExtra("version_app");
            if (newVer != null && !newVer.isEmpty()) versionApp = newVer;
        }

        Log.d(TAG, "Starting/updating service for tecnico: " + tecnicoNombre + ", device: " + deviceId + ", URL: " + serverUrl);

        // Start as foreground service to prevent OS from killing it
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        requestLocationUpdates();

        return START_STICKY;
    }

    private void requestLocationUpdates() {
        try {
            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 15000) // 15 seconds
                    .setMinUpdateIntervalMillis(10000) // fastest interval 10 seconds
                    .setMinUpdateDistanceMeters(10) // distance filter 10 meters
                    .build();
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
            Log.d(TAG, "FusedLocationProviderClient updates requested.");
        } catch (SecurityException e) {
            Log.e(TAG, "Permission denied for location updates: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Error requesting FusedLocationProviderClient updates: " + e.getMessage());
        }

        // Register LocationManager as a parallel fallback source
        try {
            if (locationManager != null) {
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    locationManager.requestLocationUpdates(
                            LocationManager.GPS_PROVIDER, 
                            15000, 
                            10, 
                            nativeLocationListener, 
                            Looper.getMainLooper()
                    );
                    Log.d(TAG, "LocationManager GPS_PROVIDER updates requested.");
                }
                if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    locationManager.requestLocationUpdates(
                            LocationManager.NETWORK_PROVIDER, 
                            15000, 
                            10, 
                            nativeLocationListener, 
                            Looper.getMainLooper()
                    );
                    Log.d(TAG, "LocationManager NETWORK_PROVIDER updates requested.");
                }
            }
        } catch (SecurityException e) {
            Log.e(TAG, "Permission denied for LocationManager: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Error requesting LocationManager updates: " + e.getMessage());
        }
    }

    private void postLocation(Location location) {
        if (location == null) return;
        if (serverUrl == null || serverUrl.isEmpty()) {
            Log.w(TAG, "Server URL is empty, skipping post");
            return;
        }

        final double latitude = location.getLatitude();
        final double longitude = location.getLongitude();
        final float accuracy = location.hasAccuracy() ? location.getAccuracy() : 0.0f;
        final float speed = location.hasSpeed() ? location.getSpeed() : 0.0f;
        final float bearing = location.hasBearing() ? location.getBearing() : 0.0f;
        final double altitude = location.hasAltitude() ? location.getAltitude() : 0.0;

        // Lectura nativa de Batería
        int batteryPct = 100;
        boolean isCharging = false;
        try {
            IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
            Intent batteryStatus = registerReceiver(null, ifilter);
            if (batteryStatus != null) {
                int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                if (level >= 0 && scale > 0) {
                    batteryPct = (int) ((level / (float) scale) * 100);
                }
                int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                isCharging = (status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error reading battery status: " + e.getMessage());
        }

        // Lectura nativa de Red (WiFi vs Móvil)
        String netType = "4G/Móvil";
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo netInfo = cm != null ? cm.getActiveNetworkInfo() : null;
            if (netInfo != null && netInfo.isConnected()) {
                if (netInfo.getType() == ConnectivityManager.TYPE_WIFI) {
                    netType = "WiFi";
                }
            }
        } catch (Exception ignored) {}

        final int finalBattery = batteryPct;
        final boolean finalCharging = isCharging;
        final String finalNetType = netType;

        executorService.execute(() -> {
            String baseUrl = serverUrl.endsWith("/") ? serverUrl.substring(0, serverUrl.length() - 1) : serverUrl;

            // 1. Si hay una visita activa en camino, enviar a rastreo_vivo de la visita
            if (idVisita != null && !idVisita.isEmpty() && !idVisita.equals("0")) {
                HttpURLConnection connVisita = null;
                try {
                    URL urlVisita = new URL(baseUrl + "/api/tecnico/rastreo_vivo/" + idVisita);
                    connVisita = (HttpURLConnection) urlVisita.openConnection();
                    connVisita.setRequestMethod("POST");
                    connVisita.setRequestProperty("Content-Type", "application/json; utf-8");
                    connVisita.setRequestProperty("Accept", "application/json");
                    if (authToken != null && !authToken.isEmpty()) {
                        connVisita.setRequestProperty("Authorization", authToken.startsWith("Bearer ") ? authToken : "Bearer " + authToken);
                    }
                    try {
                        String cookies = CookieManager.getInstance().getCookie(baseUrl);
                        if (cookies != null && !cookies.isEmpty()) connVisita.setRequestProperty("Cookie", cookies);
                    } catch (Exception ignored) {}

                    connVisita.setDoOutput(true);
                    connVisita.setConnectTimeout(8000);
                    connVisita.setReadTimeout(8000);

                    JSONObject jsonParam = new JSONObject();
                    jsonParam.put("latitud", latitude);
                    jsonParam.put("longitud", longitude);
                    jsonParam.put("bateria", finalBattery);
                    jsonParam.put("cargando", finalCharging ? 1 : 0);
                    jsonParam.put("precision", accuracy);
                    jsonParam.put("velocidad", speed);
                    jsonParam.put("bearing", bearing);
                    jsonParam.put("altitud", altitude);
                    if (deviceId != null && !deviceId.isEmpty()) jsonParam.put("device_id", deviceId);
                    if (deviceModel != null && !deviceModel.isEmpty()) jsonParam.put("modelo_dispositivo", deviceModel);
                    if (tecnicoNombre != null && !tecnicoNombre.isEmpty()) jsonParam.put("tecnico_nombre", tecnicoNombre);
                    if (versionApp != null && !versionApp.isEmpty()) jsonParam.put("version_app", versionApp);

                    try (OutputStream os = connVisita.getOutputStream()) {
                        byte[] input = jsonParam.toString().getBytes("utf-8");
                        os.write(input, 0, input.length);
                    }
                    connVisita.getResponseCode();
                } catch (Exception e) {
                    Log.e(TAG, "Error posting to rastreo_vivo: " + e.getMessage());
                } finally {
                    if (connVisita != null) connVisita.disconnect();
                }
            }

            // 2. Enviar siempre a ping_global con telemetría completa de batería y dispositivo
            HttpURLConnection connGlobal = null;
            try {
                URL urlGlobal = new URL(baseUrl + "/api/tecnico/ping_global");
                connGlobal = (HttpURLConnection) urlGlobal.openConnection();
                connGlobal.setRequestMethod("POST");
                connGlobal.setRequestProperty("Content-Type", "application/json; utf-8");
                connGlobal.setRequestProperty("Accept", "application/json");

                // Inyectar Token de autorización
                if (authToken != null && !authToken.isEmpty()) {
                    connGlobal.setRequestProperty("Authorization", authToken.startsWith("Bearer ") ? authToken : "Bearer " + authToken);
                }
                // Inyectar Cookies del WebView
                try {
                    String cookies = CookieManager.getInstance().getCookie(baseUrl);
                    if (cookies != null && !cookies.isEmpty()) connGlobal.setRequestProperty("Cookie", cookies);
                } catch (Exception ignored) {}

                connGlobal.setDoOutput(true);
                connGlobal.setConnectTimeout(8000);
                connGlobal.setReadTimeout(8000);

                JSONObject jsonGlobal = new JSONObject();
                jsonGlobal.put("latitud", latitude);
                jsonGlobal.put("longitud", longitude);
                jsonGlobal.put("precision", accuracy);
                jsonGlobal.put("velocidad", speed);
                jsonGlobal.put("bearing", bearing);
                jsonGlobal.put("altitud", altitude);
                jsonGlobal.put("bateria", finalBattery);
                jsonGlobal.put("cargando", finalCharging);
                jsonGlobal.put("network_type", finalNetType);
                if (tecnicoNombre != null && !tecnicoNombre.isEmpty()) {
                    jsonGlobal.put("tecnico_nombre", tecnicoNombre);
                }
                if (deviceId != null && !deviceId.isEmpty()) {
                    jsonGlobal.put("device_id", deviceId);
                }
                if (deviceModel != null && !deviceModel.isEmpty()) {
                    jsonGlobal.put("modelo_dispositivo", deviceModel);
                }
                if (versionApp != null && !versionApp.isEmpty()) {
                    jsonGlobal.put("version_app", versionApp);
                }

                try (OutputStream os = connGlobal.getOutputStream()) {
                    byte[] input = jsonGlobal.toString().getBytes("utf-8");
                    os.write(input, 0, input.length);
                }
                int code = connGlobal.getResponseCode();
                Log.d(TAG, "Global ping POST result: " + code + " (bat: " + finalBattery + "%, chg: " + finalCharging + ")");
            } catch (Exception e) {
                Log.e(TAG, "Error posting to ping_global: " + e.getMessage());
            } finally {
                if (connGlobal != null) connGlobal.disconnect();
            }
        });
    }

    private Notification buildNotification() {
        String title = getString(R.string.location_service_notification_title);
        String text = getString(R.string.location_service_notification_text);
        String channelId = getString(R.string.location_service_channel_id);

        return new NotificationCompat.Builder(this, channelId)
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            String channelId = getString(R.string.location_service_channel_id);
            CharSequence name = getString(R.string.location_service_channel_name);
            int importance = NotificationManager.IMPORTANCE_LOW;
            
            NotificationChannel channel = new NotificationChannel(channelId, name, importance);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Stopping location service");
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        if (locationManager != null && nativeLocationListener != null) {
            locationManager.removeUpdates(nativeLocationListener);
        }
        if (executorService != null) {
            executorService.shutdown();
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
                Log.d(TAG, "PARTIAL_WAKE_LOCK released");
            } catch (Exception e) {
                Log.e(TAG, "Error releasing WakeLock: " + e.getMessage());
            }
            wakeLock = null;
        }
        stopForeground(true);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
