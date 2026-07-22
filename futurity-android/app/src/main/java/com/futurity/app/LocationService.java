package com.futurity.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

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
import android.os.PowerManager;
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
                    Log.d(TAG, "Location updated: " + location.getLatitude() + ", " + location.getLongitude());
                    postLocation(location.getLatitude(), location.getLongitude());
                }
            }
        };

        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        nativeLocationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (location != null) {
                    Log.d(TAG, "Location updated (LocationManager): " + location.getLatitude() + ", " + location.getLongitude());
                    postLocation(location.getLatitude(), location.getLongitude());
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
                Log.d(TAG, "PARTIAL_WAKE_LOCK acquired for background tracking");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error acquiring WakeLock: " + e.getMessage());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            idVisita = intent.getStringExtra("id_visita");
            serverUrl = intent.getStringExtra("server_url");
        }

        Log.d(TAG, "Starting service for visita " + idVisita + " to " + serverUrl);

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

    private void postLocation(double latitude, double longitude) {
        if (serverUrl == null || serverUrl.isEmpty() || idVisita == null || idVisita.isEmpty()) {
            Log.w(TAG, "Server URL or Visita ID is empty, skipping post");
            return;
        }

        executorService.execute(() -> {
            HttpURLConnection conn = null;
            try {
                // Remove trailing slash if present
                String baseUrl = serverUrl.endsWith("/") ? serverUrl.substring(0, serverUrl.length() - 1) : serverUrl;
                URL url = new URL(baseUrl + "/api/tecnico/rastreo_vivo/" + idVisita);
                
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                JSONObject jsonParam = new JSONObject();
                jsonParam.put("latitud", latitude);
                jsonParam.put("longitud", longitude);

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonParam.toString().getBytes("utf-8");
                    os.write(input, 0, input.length);
                }

                int code = conn.getResponseCode();
                Log.i(TAG, "POST location response code: " + code);
            } catch (Exception e) {
                Log.e(TAG, "Error posting location: " + e.getMessage(), e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
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
                .setSmallIcon(android.R.drawable.ic_menu_mylocation) // default system GPS icon
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
