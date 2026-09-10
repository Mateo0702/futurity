import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/visita_model.dart';
import '../models/inventario_model.dart';
import '../models/requisicion_model.dart';

class ApiService {
  static const String baseUrl = 'https://atlas.futurity.com.ec';

  // --- 1. AUTENTICACIÓN JWT ---
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final url = Uri.parse('$baseUrl/api/v2/login');
    try {
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email.trim(),
          'password': password.trim(),
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['token'] != null) {
        final prefs = await SharedPreferences.getInstance();
        final usr = data['usuario'] ?? data['user'] ?? {};
        await prefs.setString('jwt_token', data['token']);
        await prefs.setString('user_name', usr['nombre'] ?? '');
        await prefs.setString('user_email', email.trim());
        await prefs.setString('user_role', usr['rol'] ?? '');
        return {'success': true, 'data': data};
      } else {
        return {
          'success': false,
          'message': data['message'] ?? 'Error al iniciar sesión'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión con el servidor: $e'};
    }
  }

  // --- 2. OBTENER PANEL Y VISITAS DEL TÉCNICO ---
  static Future<Map<String, dynamic>> getPanelTecnico() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final username = prefs.getString('user_name') ?? '';

    if (username.isEmpty || token.isEmpty) {
      return {'success': false, 'message': 'Sesión expirada o no encontrada'};
    }

    final url = Uri.parse('$baseUrl/api/tecnico/panel/${Uri.encodeComponent(username)}');
    try {
      final response = await http.get(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final rawVisitas = data['visitas'] as List? ?? [];
        final visitas = rawVisitas.map((v) => VisitaModel.fromJson(v)).toList();

        return {
          'success': true,
          'tecnico': {
            'nombre': data['tecnico'] is String ? data['tecnico'] : (data['tecnico']?['nombre'] ?? username),
            'foto_perfil': data['foto_perfil'] ?? 'default_avatar.png',
            'estado_actividad': data['estado_actividad'] ?? 'Disponible',
            'area_trabajo': data['area_trabajo'] ?? 'SOPORTE',
          },
          'visitas': visitas,
          'materiales': data['catalogo'] ?? [],
          'soluciones': data['soluciones'] ?? [],
          'catalogo_ont': data['catalogo_ont'] ?? [],
          'catalogo_router': data['catalogo_router'] ?? [],
        };
      } else {
        return {'success': false, 'message': 'Error al obtener panel (${response.statusCode})'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  // --- FINALIZAR VISITA ---
  static Future<Map<String, dynamic>> finalizarVisita(int idVisita, Map<String, dynamic> payload) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/api/tecnico/finalizar/$idVisita');

    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(payload),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && (data['status'] == 'ok' || data['status'] == 'success')) {
        return {'success': true, 'message': data['message'] ?? 'Visita finalizada y registrada con éxito'};
      } else {
        return {'success': false, 'message': data['message'] ?? 'Error al finalizar visita (${response.statusCode})'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión con el servidor: $e'};
    }
  }

  // --- POSPONER VISITA ---
  static Future<Map<String, dynamic>> posponerVisita(int idVisita, String motivo, {String? detalle}) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/api/tecnico/posponer/$idVisita');

    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'motivo': motivo,
          'motivo_otro': detalle,
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && (data['status'] == 'ok' || data['status'] == 'success')) {
        return {'success': true, 'message': data['message'] ?? 'Visita pospuesta con éxito'};
      }
      return {'success': false, 'message': data['message'] ?? 'Error al posponer visita'};
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  // --- INICIAR VISITA EN SITIO ---
  static Future<Map<String, dynamic>> iniciarVisita(int idVisita) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/api/tecnico/iniciar/$idVisita');

    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && (data['status'] == 'ok' || data['status'] == 'success')) {
        return {'success': true};
      }
      return {'success': false, 'message': data['message'] ?? 'No se pudo iniciar la atención en sitio'};
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  // --- 3. ENVIAR COORDENADAS GPS EN VIVO ---
  static Future<bool> enviarUbicacionGps(int idVisita, double latitud, double longitud) async {
    final url = Uri.parse('$baseUrl/api/tecnico/rastreo_vivo/$idVisita');
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';

    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          if (token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'latitud': latitud,
          'longitud': longitud,
        }),
      );

      return response.statusCode == 200;
    } catch (e) {
      // Ignorar error transitorio de red en segundo plano
      return false;
    }
  }

  // --- 4. CAMBIAR ESTADO A EN RUTA ---
  static Future<Map<String, dynamic>> iniciarRuta(int idVisita) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/tecnico/iniciar_ruta/$idVisita');

    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200 || response.statusCode == 302) {
        return {'success': true};
      }
      return {'success': false, 'message': 'No se pudo iniciar ruta'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // --- 5. CERRAR SESIÓN ---
  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }

  // --- 6. DIAGNÓSTICO SMARTOLT EN VIVO ---
  static Future<Map<String, dynamic>> getDiagnosticoSmartOlt(String sn) async {
    final cleanSn = sn.trim().toUpperCase();
    if (cleanSn.isEmpty || cleanSn == 'S/N' || cleanSn == 'NONE' || cleanSn == 'NULL') {
      return {'success': false, 'message': 'Número de serie de ONT no válido para consulta en SmartOLT'};
    }

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/api/admin/smartolt/diagnostico/${Uri.encodeComponent(cleanSn)}');

    try {
      final response = await http.get(
        url,
        headers: {
          'Content-Type': 'application/json',
          if (token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['status'] == 'success' && data['diagnostico'] != null) {
        return {'success': true, 'diagnostico': data['diagnostico']};
      } else {
        return {
          'success': false,
          'message': data['message'] ?? 'El equipo no se encuentra registrado en ninguna central SmartOLT activa.'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión con el servidor: $e'};
    }
  }

  // --- 8. OBTENER MI INVENTARIO Y EQUIPOS RETIRADOS ---
  static Future<Map<String, dynamic>> getMiInventario() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/api/tecnico/mi_inventario');

    try {
      final response = await http.get(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['status'] == 'ok') {
        final rawMat = data['materiales'] as List? ?? [];
        final rawEq = data['equipos_retirados'] as List? ?? [];
        final materiales = rawMat.map((m) => MaterialVehiculo.fromJson(m)).toList();
        final equipos = rawEq.map((e) => EquipoRetirado.fromJson(e)).toList();

        return {
          'success': true,
          'tecnico': data['tecnico'] ?? '',
          'placa': data['placa'] ?? 'S/P',
          'materiales': materiales,
          'equipos_retirados': equipos,
        };
      }
      return {'success': false, 'message': data['message'] ?? 'Error al obtener inventario'};
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  // --- 9. DEVOLVER EQUIPOS A BODEGA CENTRAL ---
  static Future<Map<String, dynamic>> devolverEquiposBodega(List<int> idsRetiro) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/api/tecnico/devolver_equipos_bodega');

    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'ids_retiro': idsRetiro}),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['status'] == 'ok') {
        return {'success': true, 'message': data['message'] ?? 'Equipos devueltos exitosamente'};
      }
      return {'success': false, 'message': data['message'] ?? 'Error al devolver equipos'};
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  // --- 10. OBTENER REQUISICIONES DEL TÉCNICO ---
  static Future<Map<String, dynamic>> getMisRequisiciones() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/api/tecnico/mis_requisiciones');

    try {
      final response = await http.get(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['status'] == 'ok') {
        final rawReqs = data['requisiciones'] as List? ?? [];
        final reqs = rawReqs.map((r) => Requisicion.fromJson(r)).toList();

        return {
          'success': true,
          'requisiciones': reqs,
          'total_listas_para_firmar': data['total_listas_para_firmar'] ?? 0,
        };
      }
      return {'success': false, 'message': data['message'] ?? 'Error al obtener requisiciones'};
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  // --- 11. CREAR SOLICITUD DE MATERIALES A BODEGA ---
  static Future<Map<String, dynamic>> crearSolicitudBodega({
    required String placaVehiculo,
    required String nombreTecnico,
    required List<Map<String, dynamic>> items,
    String? observaciones,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/api/admin/requisiciones/crear');

    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'placa_vehiculo': placaVehiculo,
          'nombre_tecnico': nombreTecnico,
          'items': items,
          'observaciones': observaciones ?? '',
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['status'] == 'ok') {
        return {'success': true, 'message': data['message'] ?? 'Solicitud enviada a bodega con éxito'};
      }
      return {'success': false, 'message': data['message'] ?? 'Error al crear solicitud'};
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  // --- 12. FIRMAR REQUISICIÓN DESDE EL MÓVIL ---
  static Future<Map<String, dynamic>> firmarRequisicion(int idRequisicion, String firmaBase64) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/api/tecnico/requisiciones/$idRequisicion/firmar');

    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'firma_tecnico': firmaBase64}),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['status'] == 'ok') {
        return {'success': true, 'message': data['message'] ?? 'Firma registrada con éxito'};
      }
      return {'success': false, 'message': data['message'] ?? 'Error al registrar la firma'};
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  // --- 13. TRASPASO DE MATERIAL A OTRO TÉCNICO ---
  static Future<Map<String, dynamic>> traspasoMaterial({
    required String tecnicoDestino,
    required int idMaterial,
    required int cantidad,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/api/tecnico/traspaso_material');

    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'tecnico_destino_nombre': tecnicoDestino,
          'id_material': idMaterial,
          'cantidad': cantidad,
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['status'] == 'ok') {
        return {'success': true, 'message': data['message'] ?? 'Traspaso realizado con éxito'};
      }
      return {'success': false, 'message': data['message'] ?? 'Error al realizar el traspaso'};
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  // --- 14. ACTIVAR / DESACTIVAR BOTÓN DE PÁNICO ---
  static Future<Map<String, dynamic>> activarPanico(String motivo, {String? detalle}) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/api/tecnico/panico/activar');

    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'motivo': motivo,
          'mensaje_panico': detalle ?? motivo,
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['status'] == 'ok') {
        return {'success': true, 'message': data['message'] ?? 'Alerta de pánico activada'};
      }
      return {'success': false, 'message': data['message'] ?? 'Error al activar pánico'};
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  static Future<Map<String, dynamic>> desactivarPanico() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final url = Uri.parse('$baseUrl/api/tecnico/panico/desactivar');

    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['status'] == 'ok') {
        return {'success': true, 'message': data['message'] ?? 'Alerta de pánico desactivada'};
      }
      return {'success': false, 'message': data['message'] ?? 'Error al desactivar pánico'};
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  // --- 15. VERIFICAR SESIÓN ---
  static Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey('jwt_token');
  }
}



