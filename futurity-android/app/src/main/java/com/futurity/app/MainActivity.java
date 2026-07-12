package com.futurity.app;

import android.Manifest;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.util.ArrayList;
import java.util.List;

import android.location.Location;
import android.os.Looper;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

public class MainActivity extends AppCompatActivity {
    private static final String TAG = "MainActivity";
    private static final int PERMISSION_REQUEST_CODE = 200;
    private static final int BACKGROUND_PERMISSION_REQUEST_CODE = 201;
    private static final int FILECHOOSER_RESULTCODE = 202;

    private WebView webView;
    private FusedLocationProviderClient fusedLocationClient;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ValueCallback<Uri[]> uploadMessage;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout);
        swipeRefreshLayout.setOnRefreshListener(() -> webView.reload());

        setupWebView();

        // Check and request standard location and notification permissions
        checkAndRequestPermissions();

        // Handle Back button inside WebView
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        String url = getString(R.string.server_url);
        Log.i(TAG, "Loading URL: " + url);
        webView.loadUrl(url);
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        
        // Enable file access & permissions
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        
        // Ensure cookies work correctly
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        // WebApp client to ensure links stay in app
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // Si es un enlace de Google Maps, lo abrimos en la app nativa del teléfono
                if (url.contains("maps.google") || url.contains("google.com/maps")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        intent.setPackage("com.google.android.apps.maps");
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        try {
                            Intent fallback = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            startActivity(fallback);
                            return true;
                        } catch (Exception ex) {
                            Log.e(TAG, "Error al abrir enlace de mapa: " + url, ex);
                        }
                    }
                }

                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return false; // Load in WebView
                }
                // Handle tel:, mailto:, whatsapp: links externally
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "Error handling external URL: " + url, e);
                    return true;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                swipeRefreshLayout.setRefreshing(false);
            }
        });

        // Disable pull-to-refresh when WebView is scrolled down
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            webView.setOnScrollChangeListener((v, scrollX, scrollY, oldScrollX, oldScrollY) -> {
                swipeRefreshLayout.setEnabled(scrollY == 0);
            });
        }

        // Enable Geolocation inside WebView
        settings.setGeolocationEnabled(true);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, android.webkit.GeolocationPermissions.Callback callback) {
                // Automatically grant Geolocation permissions to the WebView origin
                callback.invoke(origin, true, false);
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                }
                uploadMessage = filePathCallback;

                Intent intent = null;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    intent = fileChooserParams.createIntent();
                } else {
                    intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("image/*");
                }

                try {
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                } catch (Exception e) {
                    uploadMessage = null;
                    Toast.makeText(MainActivity.this, "Error al abrir cámara o galería", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        // Register the JS interface
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");
    }

    private boolean checkAndRequestPermissions() {
        List<String> listPermissionsNeeded = new ArrayList<>();

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            listPermissionsNeeded.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            listPermissionsNeeded.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        
        // Post notifications permission for Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                listPermissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!listPermissionsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(this, listPermissionsNeeded.toArray(new String[0]), PERMISSION_REQUEST_CODE);
            return false;
        }

        // Standard permissions are already granted, let's request background if needed
        checkBackgroundLocationPermission();
        return true;
    }

    private void checkBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                showBackgroundLocationRationaleDialog();
            }
        }
    }

    private void showBackgroundLocationRationaleDialog() {
        new AlertDialog.Builder(this)
                .setTitle("Permiso de ubicación en segundo plano")
                .setMessage("Para rastrear su ubicación en segundo plano cuando la pantalla esté apagada, seleccione \"Permitir todo el tiempo\" (Allow all the time) en la pantalla de configuración que aparecerá a continuación.")
                .setPositiveButton("Configurar", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            ActivityCompat.requestPermissions(MainActivity.this,
                                    new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION},
                                    BACKGROUND_PERMISSION_REQUEST_CODE);
                        }
                    }
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean allGranted = true;
            for (int res : grantResults) {
                if (res != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            if (allGranted) {
                Log.d(TAG, "Standard permissions granted. Checking background location.");
                checkBackgroundLocationPermission();
            } else {
                Toast.makeText(this, "Se requieren permisos de ubicación para el funcionamiento correcto de la app.", Toast.LENGTH_LONG).show();
            }
        } else if (requestCode == BACKGROUND_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Background location permission granted.");
            } else {
                Toast.makeText(this, "Para rastrear en segundo plano con pantalla apagada, configure el permiso en 'Permitir todo el tiempo'.", Toast.LENGTH_LONG).show();
            }
        }
    }

    // --- Javascript Interface Class ---
    public class WebAppInterface {
        @JavascriptInterface
        public void startTracking(String idVisita, String serverUrl) {
            Log.d(TAG, "JS triggered startTracking: " + idVisita + ", URL: " + serverUrl);
            runOnUiThread(() -> startTrackingService(idVisita, serverUrl));
        }

        @JavascriptInterface
        public void stopTracking() {
            Log.d(TAG, "JS triggered stopTracking");
            runOnUiThread(() -> stopTrackingService());
        }

        @JavascriptInterface
        public void showSettings() {
            Log.d(TAG, "JS triggered showSettings");
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                Uri uri = Uri.fromParts("package", getPackageName(), null);
                intent.setData(uri);
                startActivity(intent);
            });
        }

        @JavascriptInterface
        public void requestSingleLocation(final String tipo) {
            Log.d(TAG, "JS triggered requestSingleLocation for: " + tipo);
            runOnUiThread(() -> fetchSingleLocationAndSendBack(tipo));
        }
    }

    private void fetchSingleLocationAndSendBack(final String tipo) {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            checkAndRequestPermissions();
            return;
        }

        fusedLocationClient.getLastLocation().addOnSuccessListener(this, location -> {
            if (location != null && (System.currentTimeMillis() - location.getTime() < 30000)) {
                sendLocationToWebView(tipo, location.getLatitude(), location.getLongitude());
            } else {
                LocationRequest singleRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 0)
                        .setMaxUpdates(1)
                        .setDurationMillis(10000)
                        .build();

                fusedLocationClient.requestLocationUpdates(singleRequest, new LocationCallback() {
                    @Override
                    public void onLocationResult(LocationResult locationResult) {
                        if (locationResult != null && locationResult.getLastLocation() != null) {
                            Location loc = locationResult.getLastLocation();
                            sendLocationToWebView(tipo, loc.getLatitude(), loc.getLongitude());
                        } else {
                            if (location != null) {
                                sendLocationToWebView(tipo, location.getLatitude(), location.getLongitude());
                            } else {
                                runOnUiThread(() -> webView.evaluateJavascript("alert('No se pudo obtener la ubicación GPS nativa. Active la ubicación del teléfono.');", null));
                            }
                        }
                    }
                }, Looper.getMainLooper());
            }
        });
    }

    private void sendLocationToWebView(String tipo, double lat, double lon) {
        String jsCode = String.format("javascript:if(window.recibirUbicacionNativa){window.recibirUbicacionNativa('%s', %s, %s);}", 
                tipo, String.valueOf(lat), String.valueOf(lon));
        runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                webView.evaluateJavascript(jsCode, null);
            } else {
                webView.loadUrl(jsCode);
            }
        });
    }

    public void startTrackingService(String idVisita, String serverUrl) {
        // Double check permissions
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            checkAndRequestPermissions();
            return;
        }

        Intent serviceIntent = new Intent(this, LocationService.class);
        serviceIntent.putExtra("id_visita", idVisita);
        serviceIntent.putExtra("server_url", serverUrl);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
        Log.d(TAG, "Foreground location service started from WebView trigger");
    }

    public void stopTrackingService() {
        Intent serviceIntent = new Intent(this, LocationService.class);
        stopService(serviceIntent);
        Log.d(TAG, "Foreground location service stopped from WebView trigger");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (uploadMessage == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK) {
                if (data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
            }
            uploadMessage.onReceiveValue(results);
            uploadMessage = null;
        }
    }
}
