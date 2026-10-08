import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api_service.dart';

class LocationTrackingService {
  static StreamSubscription<Position>? _positionStreamSubscription;
  static Timer? _timer;
  static int? _activeVisitaId;
  static bool _isTracking = false;
  static final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();

  static bool get isTracking => _isTracking;
  static int? get activeVisitaId => _activeVisitaId;

  static void setActiveVisita(int? idVisita) {
    _activeVisitaId = idVisita;
    debugPrint('[GPS Tracker] Visita activa establecida: $_activeVisitaId');
  }

  // Inicializar notificaciones y solicitar permisos
  static Future<void> initNotifications() async {
    try {
      const AndroidInitializationSettings initializationSettingsAndroid =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      const InitializationSettings initializationSettings =
          InitializationSettings(android: initializationSettingsAndroid);
      await _notificationsPlugin.initialize(initializationSettings);

      final androidImpl = _notificationsPlugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      if (androidImpl != null) {
        await androidImpl.requestNotificationsPermission();
      }
    } catch (e) {
      debugPrint('[Notifications] Error inicializando notificaciones: $e');
    }
  }

  // Solicitar permisos de ubicación y notificaciones
  static Future<bool> requestPermissions() async {
    await initNotifications();

    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      debugPrint('[GPS Tracker] Servicio de ubicación deshabilitado en el dispositivo');
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        debugPrint('[GPS Tracker] Permiso de ubicación denegado');
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      debugPrint('[GPS Tracker] Permiso de ubicación denegado permanentemente');
      return false;
    }

    return true;
  }

  // Iniciar rastreo de GPS continuo en primer plano y segundo plano
  static Future<bool> startTracking([int? idVisita]) async {
    if (_isTracking && idVisita == null) {
      debugPrint('[GPS Tracker] Ya se encuentra rastreando activamente.');
      return true;
    }

    bool hasPermission = await requestPermissions();
    if (!hasPermission) return false;

    if (idVisita != null) {
      _activeVisitaId = idVisita;
    }

    if (_isTracking) {
      debugPrint('[GPS Tracker] Actualizando visita activa a $_activeVisitaId en rastreador existente.');
      return true;
    }

    _isTracking = true;

    // 1. Enviar ubicación inicial inmediata
    try {
      Position initialPos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 5),
      );
      // Siempre enviar a ping_global para mapa central
      await ApiService.enviarPingGlobal(initialPos.latitude, initialPos.longitude);
      // Si hay visita activa, enviar a rastreo de visita
      if (_activeVisitaId != null && _activeVisitaId! > 0) {
        await ApiService.enviarUbicacionGps(_activeVisitaId!, initialPos.latitude, initialPos.longitude);
      }
      debugPrint('[GPS Tracker] Ubicación inicial emitida: ${initialPos.latitude}, ${initialPos.longitude}');
    } catch (e) {
      debugPrint('[GPS Tracker] Error obteniendo ubicación inicial: $e');
    }

    // 2. Configurar Foreground Service para mantener GPS activo con pantalla apagada o en segundo plano
    late LocationSettings locationSettings;

    if (defaultTargetPlatform == TargetPlatform.android) {
      locationSettings = AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 3, // Emite cada 3 metros
        forceLocationManager: false,
        intervalDuration: const Duration(seconds: 5),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: "🟢 Futurity - Operaciones Conectadas",
          notificationText: "Rastreo satelital activo en tiempo real.",
          notificationIcon: AndroidResource(name: 'ic_launcher', defType: 'mipmap'),
          enableWakeLock: true,
          enableWifiLock: true,
        ),
      );
    } else if (defaultTargetPlatform == TargetPlatform.iOS || defaultTargetPlatform == TargetPlatform.macOS) {
      locationSettings = AppleSettings(
        accuracy: LocationAccuracy.high,
        activityType: ActivityType.automotiveNavigation,
        distanceFilter: 3,
        pauseLocationUpdatesAutomatically: false,
        showBackgroundLocationIndicator: true,
      );
    } else {
      locationSettings = const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 3,
      );
    }

    // 3. Stream continuo de GPS
    _positionStreamSubscription = Geolocator.getPositionStream(locationSettings: locationSettings).listen(
      (Position position) async {
        // Enviar a supervisión central siempre
        await ApiService.enviarPingGlobal(position.latitude, position.longitude);

        // Si hay una visita activa en ruta, enviar al seguimiento del cliente
        if (_activeVisitaId != null && _activeVisitaId! > 0) {
          await ApiService.enviarUbicacionGps(_activeVisitaId!, position.latitude, position.longitude);
        }
      },
      onError: (error) {
        debugPrint('[GPS Tracker Stream] Error en stream de ubicación: $error');
      },
    );

    // 4. Temporizador de respaldo periódico cada 15 segundos (para semáforos o vehículos detenidos)
    _timer = Timer.periodic(const Duration(seconds: 15), (timer) async {
      if (!_isTracking) {
        timer.cancel();
        return;
      }
      try {
        Position pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 4),
        );
        await ApiService.enviarPingGlobal(pos.latitude, pos.longitude);
        if (_activeVisitaId != null && _activeVisitaId! > 0) {
          await ApiService.enviarUbicacionGps(_activeVisitaId!, pos.latitude, pos.longitude);
        }
      } catch (e) {
        debugPrint('[GPS Tracker Heartbeat] Error en ping periódico: $e');
      }
    });

    return true;
  }

  // Detener rastreo (solo invocado internamente al cerrar sesión)
  static void stopTracking() {
    _isTracking = false;
    _activeVisitaId = null;
    _positionStreamSubscription?.cancel();
    _positionStreamSubscription = null;
    _timer?.cancel();
    _timer = null;
    debugPrint('[GPS Tracker] Rastreo detenido por cierre de sesión.');
  }
}
