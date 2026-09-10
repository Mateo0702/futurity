import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import '../models/visita_model.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../widgets/firma_canvas_widget.dart';

class CierreVisitaScreen extends StatefulWidget {
  final VisitaModel visita;
  final List<dynamic> soluciones;
  final List<dynamic> catalogoMateriales;
  final List<dynamic> catalogoOnt;
  final List<dynamic> catalogoRouter;

  const CierreVisitaScreen({
    super.key,
    required this.visita,
    this.soluciones = const [],
    this.catalogoMateriales = const [],
    this.catalogoOnt = const [],
    this.catalogoRouter = const [],
  });

  @override
  State<CierreVisitaScreen> createState() => _CierreVisitaScreenState();
}

class _CierreVisitaScreenState extends State<CierreVisitaScreen> {
  final _formKey = GlobalKey<FormState>();
  final ImagePicker _picker = ImagePicker();
  final GlobalKey<FirmaCanvasWidgetState> _firmaKey = GlobalKey<FirmaCanvasWidgetState>();

  // 1. Solución y Observaciones
  String? _solucionSeleccionada;
  late TextEditingController _obsController;

  // 2. Equipos Instalados
  late TextEditingController _modeloOnuController;
  late TextEditingController _snOnuController;
  late TextEditingController _modeloRouterController;
  late TextEditingController _snRouterController;
  bool _tieneMesh = false;
  late TextEditingController _modeloRouterSecundarioController;
  late TextEditingController _snRouterSecundarioController;
  String _tipoMesh = 'WIFI 6';
  int _cantidadRouters = 1;

  // 3. Equipos Retirados
  bool _huboCambioOnu = false;
  late TextEditingController _snRetiradoOnuController;
  late TextEditingController _modeloRetiradoOnuController;
  String _motivoRetiroOnu = 'DANADO_FALLA';
  late TextEditingController _obsRetiroOnuController;

  bool _huboCambioRouter = false;
  late TextEditingController _snRetiradoRouterController;
  late TextEditingController _modeloRetiradoRouterController;
  String _motivoRetiroRouter = 'DANADO_FALLA';
  late TextEditingController _obsRetiroRouterController;

  // 4. Materiales Consumidos
  final List<Map<String, dynamic>> _materialesSeleccionados = [];

  // 5. Evidencias Fotográficas
  bool _equiposJuntos = true;
  XFile? _fotoEquipos;
  XFile? _fotoEquipos2;
  final List<XFile?> _fotosExtra = [null, null, null, null];

  // 6. Firma de Conformidad
  String _metodoFirma = 'DIRECTA'; // 'DIRECTA' | 'SIN_FIRMA'
  String _motivoSinFirma = 'TRABAJO_EXTERNO';
  late TextEditingController _motivoSinFirmaOtroController;

  // Estado de envío
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _obsController = TextEditingController();

    // Inicializar con los datos actuales de la visita
    _modeloOnuController = TextEditingController(text: widget.visita.modeloOnt ?? '');
    _snOnuController = TextEditingController(text: widget.visita.numeroSerie ?? '');
    _modeloRouterController = TextEditingController(text: widget.visita.routerPrincipal ?? '');
    _snRouterController = TextEditingController(text: widget.visita.numeroSerieRouter ?? '');

    _tieneMesh = widget.visita.routerSecundario != null && widget.visita.routerSecundario!.isNotEmpty;
    _modeloRouterSecundarioController = TextEditingController(text: widget.visita.routerSecundario ?? '');
    _snRouterSecundarioController = TextEditingController(text: widget.visita.numeroSerieRouterSecundario ?? '');

    _snRetiradoOnuController = TextEditingController();
    _modeloRetiradoOnuController = TextEditingController();
    _obsRetiroOnuController = TextEditingController();

    _snRetiradoRouterController = TextEditingController();
    _modeloRetiradoRouterController = TextEditingController();
    _obsRetiroRouterController = TextEditingController();

    _motivoSinFirmaOtroController = TextEditingController();

    // Si hay soluciones en el catálogo y solo una o sugerida (excluyendo reagendar/saturar)
    final solucionesValidas = widget.soluciones.where((sol) {
      final String n = (sol is Map ? (sol['nombre'] ?? sol['solucion'] ?? '') : sol.toString()).toUpperCase();
      return !n.contains('REAGENDAD') && !n.contains('SATURACI');
    }).toList();
    if (solucionesValidas.isNotEmpty) {
      final primera = solucionesValidas.first;
      _solucionSeleccionada = primera is Map ? (primera['nombre'] ?? primera['solucion']) : primera.toString();
    }
  }

  @override
  void dispose() {
    _obsController.dispose();
    _modeloOnuController.dispose();
    _snOnuController.dispose();
    _modeloRouterController.dispose();
    _snRouterController.dispose();
    _modeloRouterSecundarioController.dispose();
    _snRouterSecundarioController.dispose();
    _snRetiradoOnuController.dispose();
    _modeloRetiradoOnuController.dispose();
    _obsRetiroOnuController.dispose();
    _snRetiradoRouterController.dispose();
    _modeloRetiradoRouterController.dispose();
    _obsRetiroRouterController.dispose();
    _motivoSinFirmaOtroController.dispose();
    super.dispose();
  }

  // --- SELECCIÓN DE FOTOGRAFÍAS ---
  Future<void> _elegirOrigenFoto(Function(XFile) onPhotoSelected) async {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Wrap(
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt_rounded, color: Color(0xFF38BDF8), size: 28),
                title: Text(
                  'Tomar Fotografía con Cámara',
                  style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w700),
                ),
                onTap: () async {
                  Navigator.pop(ctx);
                  final photo = await _picker.pickImage(
                    source: ImageSource.camera,
                    maxWidth: 1280,
                    maxHeight: 1280,
                    imageQuality: 75,
                  );
                  if (photo != null) onPhotoSelected(photo);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_rounded, color: Color(0xFF34D399), size: 28),
                title: Text(
                  'Elegir de la Galería',
                  style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w700),
                ),
                onTap: () async {
                  Navigator.pop(ctx);
                  final photo = await _picker.pickImage(
                    source: ImageSource.gallery,
                    maxWidth: 1280,
                    maxHeight: 1280,
                    imageQuality: 75,
                  );
                  if (photo != null) onPhotoSelected(photo);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --- GESTIÓN DE MATERIALES ---
  void _agregarMaterial() {
    if (widget.catalogoMateriales.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No hay catálogo de materiales cargado.')),
      );
      return;
    }

    final primerMaterial = widget.catalogoMateriales.first;
    setState(() {
      _materialesSeleccionados.add({
        'id_material': primerMaterial['id_material'],
        'nombre_material': primerMaterial['nombre_material'] ?? 'Material',
        'unidad_medida': primerMaterial['unidad_medida'] ?? 'U',
        'cantidad': 1,
      });
    });
  }

  // --- ENVÍO DEL CIERRE ---
  Future<void> _finalizarVisita() async {
    if (!_formKey.currentState!.validate()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor complete los campos obligatorios marcados en rojo.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    if (_solucionSeleccionada == null || _solucionSeleccionada!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Debe seleccionar la solución aplicada.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    if (_obsController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Debe ingresar el detalle técnico en la observación.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    // Validar foto de equipos
    if (_equiposJuntos && _fotoEquipos == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Debe capturar al menos la foto de los equipos instalados.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }
    if (!_equiposJuntos && (_fotoEquipos == null || _fotoEquipos2 == null)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Debe capturar tanto la foto de la ONU como la del Router por separado.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    // Validar firma
    String? firmaBase64;
    if (_metodoFirma == 'DIRECTA') {
      firmaBase64 = await _firmaKey.currentState?.exportBase64();
      if (!mounted) return;
      if (firmaBase64 == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('El cliente debe firmar en el recuadro para validar la conformidad.'),
            backgroundColor: Color(0xFFEF4444),
          ),
        );
        return;
      }
    }

    setState(() => _isSubmitting = true);

    try {
      // 1. Obtener coordenadas GPS de cierre
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 5),
        );
      } catch (e) {
        position = await Geolocator.getLastKnownPosition();
      }
      final String coords = position != null ? '${position.latitude},${position.longitude}' : '0.0,0.0';

      // 2. Convertir fotos a Base64
      String? fotoEquiposB64;
      if (_fotoEquipos != null) {
        final bytes = await _fotoEquipos!.readAsBytes();
        fotoEquiposB64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      }

      String? fotoEquipos2B64;
      if (!_equiposJuntos && _fotoEquipos2 != null) {
        final bytes = await _fotoEquipos2!.readAsBytes();
        fotoEquipos2B64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      }

      final List<String?> extrasB64 = [null, null, null, null];
      for (int i = 0; i < 4; i++) {
        if (_fotosExtra[i] != null) {
          final bytes = await _fotosExtra[i]!.readAsBytes();
          extrasB64[i] = 'data:image/jpeg;base64,${base64Encode(bytes)}';
        }
      }

      // 3. Preparar payload exacto para el backend
      final payload = {
        'solucion_tecnico': _solucionSeleccionada,
        'observacion_tecnico': _obsController.text.trim(),
        'modelo_onu': _modeloOnuController.text.trim().isNotEmpty ? _modeloOnuController.text.trim() : null,
        'numero_serie_onu': _snOnuController.text.trim().isNotEmpty ? _snOnuController.text.trim().toUpperCase() : null,
        'modelo_router': _modeloRouterController.text.trim().isNotEmpty ? _modeloRouterController.text.trim() : null,
        'numero_serie_router': _snRouterController.text.trim().isNotEmpty ? _snRouterController.text.trim().toUpperCase() : null,
        'router_secundario': _tieneMesh ? _modeloRouterSecundarioController.text.trim() : null,
        'numero_serie_router_secundario': _tieneMesh ? _snRouterSecundarioController.text.trim().toUpperCase() : null,
        'tipo_mesh': _tieneMesh ? _tipoMesh : null,
        'cantidad_routers': _tieneMesh ? (_cantidadRouters > 1 ? _cantidadRouters : 2) : 1,
        'coordenadas_tecnico': coords,
        'metodo_firma': _metodoFirma,
        'motivo_sin_firma': _metodoFirma == 'SIN_FIRMA'
            ? (_motivoSinFirma == 'OTROS' ? _motivoSinFirmaOtroController.text.trim() : _motivoSinFirma)
            : null,
        'equipos_juntos': _equiposJuntos ? '1' : '0',
        'foto_equipos_base64': fotoEquiposB64,
        'foto_equipos_2_base64': fotoEquipos2B64,
        'firma_cliente_base64': firmaBase64,
        'foto_extra_1_base64': extrasB64[0],
        'foto_extra_2_base64': extrasB64[1],
        'foto_extra_3_base64': extrasB64[2],
        'foto_extra_4_base64': extrasB64[3],
        'hubo_cambio_onu': _huboCambioOnu,
        'sn_retirado_onu': _huboCambioOnu ? _snRetiradoOnuController.text.trim().toUpperCase() : '',
        'modelo_retirado_onu': _huboCambioOnu ? _modeloRetiradoOnuController.text.trim() : '',
        'motivo_retiro_onu': _huboCambioOnu ? _motivoRetiroOnu : 'DANADO_FALLA',
        'obs_retiro_onu': _huboCambioOnu ? _obsRetiroOnuController.text.trim() : '',
        'hubo_cambio_router': _huboCambioRouter,
        'sn_retirado_router': _huboCambioRouter ? _snRetiradoRouterController.text.trim().toUpperCase() : '',
        'modelo_retirado_router': _huboCambioRouter ? _modeloRetiradoRouterController.text.trim() : '',
        'motivo_retiro_router': _huboCambioRouter ? _motivoRetiroRouter : 'DANADO_FALLA',
        'obs_retiro_router': _huboCambioRouter ? _obsRetiroRouterController.text.trim() : '',
        'materiales': _materialesSeleccionados.map((m) => {
          'id_material': m['id_material'],
          'cantidad': m['cantidad'],
        }).toList(),
      };

      final result = await ApiService.finalizarVisita(widget.visita.idVisita, payload);

      if (result['success'] == true) {
        // Detener rastreo GPS si estaba activo para esta visita
        if (LocationTrackingService.activeVisitaId == widget.visita.idVisita) {
          LocationTrackingService.stopTracking();
        }

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Visita finalizada con éxito.'),
              backgroundColor: const Color(0xFF10B981),
            ),
          );
          Navigator.pop(context, true); // Retorna true para refrescar la agenda
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Error al guardar el cierre.'),
              backgroundColor: const Color(0xFFEF4444),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error inesperado: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B1120),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Cierre Técnico de Visita',
              style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17),
            ),
            Text(
              'Ticket VT-${widget.visita.idVisita} • ${widget.visita.cliente}',
              style: GoogleFonts.inter(color: const Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w500),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          children: [
            // 1. TARJETA: SOLUCIÓN Y OBSERVACIONES
            _buildSectionCard(
              title: '1. Solución y Detalle Técnico',
              icon: Icons.task_alt_rounded,
              color: const Color(0xFF38BDF8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'SOLUCIÓN APLICADA *',
                    style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8)),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _solucionSeleccionada,
                        isExpanded: true,
                        dropdownColor: const Color(0xFF1E293B),
                        icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF38BDF8)),
                        hint: Text(
                          'Seleccionar Solución...',
                          style: GoogleFonts.inter(color: const Color(0xFF64748B), fontSize: 13),
                        ),
                        items: widget.soluciones.where((sol) {
                          final String n = (sol is Map ? (sol['nombre'] ?? sol['solucion'] ?? '') : sol.toString()).toUpperCase();
                          return !n.contains('REAGENDAD') && !n.contains('SATURACI');
                        }).map((sol) {
                          final String nombre = sol is Map ? (sol['nombre'] ?? sol['solucion'] ?? '') : sol.toString();
                          return DropdownMenuItem<String>(
                            value: nombre,
                            child: Text(
                              nombre,
                              style: GoogleFonts.inter(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                          );
                        }).toList(),
                        onChanged: (val) => setState(() => _solucionSeleccionada = val),
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  Text(
                    'DETALLE TÉCNICO / OBSERVACIÓN *',
                    style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8)),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _obsController,
                    maxLines: 3,
                    style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Describa el trabajo realizado, cambios de conectores, empalmes o configuraciones...',
                      hintStyle: GoogleFonts.inter(color: const Color(0xFF64748B), fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF0F172A),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFF38BDF8), width: 1.5),
                      ),
                      contentPadding: const EdgeInsets.all(12),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 2. TARJETA: EQUIPOS INSTALADOS Y MESH
            _buildSectionCard(
              title: '2. Equipos Instalados y Red',
              icon: Icons.router_rounded,
              color: const Color(0xFF818CF8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _buildInputField(
                          label: 'MODELO ONT (ONU)',
                          controller: _modeloOnuController,
                          hint: 'Ej: ZTE F670L',
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildInputField(
                          label: 'SERIE ONT (SN GPON)',
                          controller: _snOnuController,
                          hint: 'Ej: ZTEGC89A...',
                          isCode: true,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  Row(
                    children: [
                      Expanded(
                        child: _buildInputField(
                          label: 'MODELO ROUTER PRINCIPAL',
                          controller: _modeloRouterController,
                          hint: 'Ej: TP-LINK EC220',
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildInputField(
                          label: 'SERIE ROUTER PRINCIPAL',
                          controller: _snRouterController,
                          hint: 'Ej: 221A90B...',
                          isCode: true,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  // Switch Mesh Secundario
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.wifi_tethering_rounded, color: Color(0xFF818CF8), size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '¿Tiene Router Secundario / Mesh?',
                            style: GoogleFonts.inter(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Switch(
                          value: _tieneMesh,
                          activeThumbColor: const Color(0xFF818CF8),
                          onChanged: (val) => setState(() => _tieneMesh = val),
                        ),
                      ],
                    ),
                  ),

                  if (_tieneMesh) ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _buildInputField(
                            label: 'MODELO ROUTER SECUNDARIO',
                            controller: _modeloRouterSecundarioController,
                            hint: 'Ej: TP-LINK HC220',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildInputField(
                            label: 'SERIE SECUNDARIO',
                            controller: _snRouterSecundarioController,
                            hint: 'Serie Mesh...',
                            isCode: true,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: _buildDropdownField(
                            label: 'TIPO DE MESH',
                            value: _tipoMesh,
                            items: const [
                              {'id': 'WIFI 6', 'nombre': 'Wi-Fi 6 (AX)'},
                              {'id': 'DUAL BAND (AC)', 'nombre': 'Dual Band (AC)'},
                              {'id': 'TRI-BAND', 'nombre': 'Tri-Band'},
                            ],
                            onChanged: (val) => setState(() => _tipoMesh = val ?? 'WIFI 6'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildDropdownField(
                            label: 'TOTAL ROUTERS',
                            value: _cantidadRouters.toString(),
                            items: const [
                              {'id': '2', 'nombre': '2 Routers (1 Mesh)'},
                              {'id': '3', 'nombre': '3 Routers (2 Mesh)'},
                              {'id': '4', 'nombre': '4 Routers (3 Mesh)'},
                            ],
                            onChanged: (val) => setState(() => _cantidadRouters = int.tryParse(val ?? '2') ?? 2),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 3. TARJETA: LOGÍSTICA INVERSA (EQUIPOS RETIRADOS)
            _buildSectionCard(
              title: '3. Reemplazo y Retiro de Equipos',
              icon: Icons.swap_horiz_rounded,
              color: const Color(0xFFF59E0B),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Check Retiro ONU
                  Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _huboCambioOnu ? const Color(0xFFF59E0B).withValues(alpha: 0.4) : Colors.white.withValues(alpha: 0.05),
                      ),
                    ),
                    child: SwitchListTile(
                      title: Text(
                        '¿Se retiró o cambió una ONU averiada?',
                        style: GoogleFonts.inter(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                      value: _huboCambioOnu,
                      activeThumbColor: const Color(0xFFF59E0B),
                      onChanged: (val) => setState(() => _huboCambioOnu = val),
                    ),
                  ),

                  if (_huboCambioOnu) ...[
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: _buildInputField(
                                  label: 'SERIE RETIRADA ONU *',
                                  controller: _snRetiradoOnuController,
                                  hint: 'SN Retirado...',
                                  isCode: true,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: _buildInputField(
                                  label: 'MODELO RETIRADO',
                                  controller: _modeloRetiradoOnuController,
                                  hint: 'Modelo...',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          _buildDropdownField(
                            label: 'MOTIVO DE RETIRO',
                            value: _motivoRetiroOnu,
                            items: const [
                              {'id': 'DANADO_FALLA', 'nombre': 'Dañado / Falla Técnica'},
                              {'id': 'REEMPLAZO_UPGRADE', 'nombre': 'Reemplazo / Upgrade de Plan'},
                              {'id': 'EQUIPO_QUEMADO', 'nombre': 'Equipo Quemado / Sobrecarga'},
                              {'id': 'RETIRO_DEFINITIVO', 'nombre': 'Retiro por Baja Definitiva'},
                            ],
                            onChanged: (val) => setState(() => _motivoRetiroOnu = val!),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Check Retiro Router
                  Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _huboCambioRouter ? const Color(0xFFF59E0B).withValues(alpha: 0.4) : Colors.white.withValues(alpha: 0.05),
                      ),
                    ),
                    child: SwitchListTile(
                      title: Text(
                        '¿Se retiró o cambió un Router averiado?',
                        style: GoogleFonts.inter(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                      value: _huboCambioRouter,
                      activeThumbColor: const Color(0xFFF59E0B),
                      onChanged: (val) => setState(() => _huboCambioRouter = val),
                    ),
                  ),

                  if (_huboCambioRouter) ...[
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: _buildInputField(
                                  label: 'SERIE RETIRADA ROUTER *',
                                  controller: _snRetiradoRouterController,
                                  hint: 'SN Router...',
                                  isCode: true,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: _buildInputField(
                                  label: 'MODELO RETIRADO',
                                  controller: _modeloRetiradoRouterController,
                                  hint: 'Modelo...',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          _buildDropdownField(
                            label: 'MOTIVO DE RETIRO',
                            value: _motivoRetiroRouter,
                            items: const [
                              {'id': 'DANADO_FALLA', 'nombre': 'Dañado / Falla Técnica'},
                              {'id': 'REEMPLAZO_UPGRADE', 'nombre': 'Reemplazo / Upgrade'},
                              {'id': 'EQUIPO_QUEMADO', 'nombre': 'Equipo Quemado'},
                              {'id': 'RETIRO_DEFINITIVO', 'nombre': 'Retiro por Baja'},
                            ],
                            onChanged: (val) => setState(() => _motivoRetiroRouter = val!),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 4. TARJETA: DESCARGO DE MATERIALES
            _buildSectionCard(
              title: '4. Insumos (Furgoneta)',
              icon: Icons.inventory_2_rounded,
              color: const Color(0xFF34D399),
              action: InkWell(
                onTap: _agregarMaterial,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF34D399).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF34D399).withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.add_rounded, size: 16, color: Color(0xFF34D399)),
                      const SizedBox(width: 4),
                      Text(
                        'Agregar',
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                          color: const Color(0xFF34D399),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_materialesSeleccionados.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        child: Text(
                          'No se han agregado insumos descargados en esta visita.',
                          style: GoogleFonts.inter(color: const Color(0xFF64748B), fontSize: 12),
                        ),
                      ),
                    )
                  else
                    ..._materialesSeleccionados.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final mat = entry.value;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                        ),
                        child: Row(
                          children: [
                            // Selector de Material
                            Expanded(
                              flex: 3,
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<int>(
                                  value: mat['id_material'],
                                  isExpanded: true,
                                  dropdownColor: const Color(0xFF1E293B),
                                  items: widget.catalogoMateriales.map((cm) {
                                    return DropdownMenuItem<int>(
                                      value: cm['id_material'],
                                      child: Text(
                                        '${cm['nombre_material']} (${cm['unidad_medida'] ?? 'U'})',
                                        style: GoogleFonts.inter(color: Colors.white, fontSize: 12),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    );
                                  }).toList(),
                                  onChanged: (newId) {
                                    if (newId != null) {
                                      final nuevoMat = widget.catalogoMateriales.firstWhere((x) => x['id_material'] == newId);
                                      setState(() {
                                        _materialesSeleccionados[idx]['id_material'] = newId;
                                        _materialesSeleccionados[idx]['nombre_material'] = nuevoMat['nombre_material'];
                                        _materialesSeleccionados[idx]['unidad_medida'] = nuevoMat['unidad_medida'] ?? 'U';
                                      });
                                    }
                                  },
                                ),
                              ),
                            ),

                            const SizedBox(width: 8),

                            // Control de Cantidad
                            Row(
                              children: [
                                InkWell(
                                  onTap: () {
                                    if (mat['cantidad'] > 1) {
                                      setState(() => _materialesSeleccionados[idx]['cantidad']--);
                                    }
                                  },
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF1E293B),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(Icons.remove, size: 14, color: Colors.white),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 10),
                                  child: Text(
                                    '${mat['cantidad']}',
                                    style: GoogleFonts.robotoMono(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF34D399),
                                    ),
                                  ),
                                ),
                                InkWell(
                                  onTap: () {
                                    setState(() => _materialesSeleccionados[idx]['cantidad']++);
                                  },
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF1E293B),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(Icons.add, size: 14, color: Colors.white),
                                  ),
                                ),
                              ],
                            ),

                            const SizedBox(width: 4),

                            // Eliminar fila
                            IconButton(
                              icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFEF4444), size: 18),
                              onPressed: () => setState(() => _materialesSeleccionados.removeAt(idx)),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 5. TARJETA: EVIDENCIAS FOTOGRÁFICAS
            _buildSectionCard(
              title: '5. Evidencias Fotográficas',
              icon: Icons.photo_camera_rounded,
              color: const Color(0xFF38BDF8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Modo de fotos de equipos
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'UBICACIÓN DE LOS EQUIPOS INSTALADOS',
                          style: GoogleFonts.inter(
                            color: const Color(0xFF94A3B8),
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => _equiposJuntos = true),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 9),
                                  decoration: BoxDecoration(
                                    color: _equiposJuntos ? const Color(0xFF0284C7).withValues(alpha: 0.25) : Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: _equiposJuntos ? const Color(0xFF38BDF8) : Colors.white.withValues(alpha: 0.1),
                                      width: _equiposJuntos ? 1.5 : 1,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.devices_other_rounded,
                                        size: 16,
                                        color: _equiposJuntos ? const Color(0xFF38BDF8) : const Color(0xFF94A3B8),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        'Juntos',
                                        style: GoogleFonts.inter(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: _equiposJuntos ? Colors.white : const Color(0xFF94A3B8),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => _equiposJuntos = false),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 9),
                                  decoration: BoxDecoration(
                                    color: !_equiposJuntos ? const Color(0xFF0284C7).withValues(alpha: 0.25) : Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: !_equiposJuntos ? const Color(0xFF38BDF8) : Colors.white.withValues(alpha: 0.1),
                                      width: !_equiposJuntos ? 1.5 : 1,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.splitscreen_rounded,
                                        size: 16,
                                        color: !_equiposJuntos ? const Color(0xFF38BDF8) : const Color(0xFF94A3B8),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        'Separados',
                                        style: GoogleFonts.inter(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: !_equiposJuntos ? Colors.white : const Color(0xFF94A3B8),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Casillas de fotos de equipos
                  if (_equiposJuntos)
                    _buildPhotoBox(
                      title: 'FOTO CONJUNTA DE EQUIPOS *',
                      subtitle: 'Foto nítida de ONU y Router en su ubicación final',
                      file: _fotoEquipos,
                      onTap: () => _elegirOrigenFoto((photo) => setState(() => _fotoEquipos = photo)),
                      onDelete: () => setState(() => _fotoEquipos = null),
                    )
                  else
                    Row(
                      children: [
                        Expanded(
                          child: _buildPhotoBox(
                            title: 'FOTO ONU *',
                            subtitle: 'Foto de la ONT',
                            file: _fotoEquipos,
                            onTap: () => _elegirOrigenFoto((p) => setState(() => _fotoEquipos = p)),
                            onDelete: () => setState(() => _fotoEquipos = null),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildPhotoBox(
                            title: 'FOTO ROUTER *',
                            subtitle: 'Foto del Router',
                            file: _fotoEquipos2,
                            onTap: () => _elegirOrigenFoto((p) => setState(() => _fotoEquipos2 = p)),
                            onDelete: () => setState(() => _fotoEquipos2 = null),
                          ),
                        ),
                      ],
                    ),

                  const SizedBox(height: 16),

                  Text(
                    'FOTOS ADICIONALES (OPCIONALES: FACHADA, CAJA NAP, POTENCIA)',
                    style: GoogleFonts.inter(fontSize: 10.5, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8)),
                  ),
                  const SizedBox(height: 8),

                  // 4 ranuras de fotos extra
                  Row(
                    children: List.generate(4, (index) {
                      final f = _fotosExtra[index];
                      return Expanded(
                        child: Container(
                          margin: EdgeInsets.only(right: index < 3 ? 8 : 0),
                          child: _buildExtraPhotoThumbnail(
                            index: index + 1,
                            file: f,
                            onTap: () => _elegirOrigenFoto((p) => setState(() => _fotosExtra[index] = p)),
                            onDelete: () => setState(() => _fotosExtra[index] = null),
                          ),
                        ),
                      );
                    }),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 6. TARJETA: FIRMA DIGITAL DEL CLIENTE
            _buildSectionCard(
              title: '6. Firma de Conformidad',
              icon: Icons.draw_rounded,
              color: const Color(0xFF10B981),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Segmento: Firma Directa vs Sin Firma
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _metodoFirma = 'DIRECTA'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: _metodoFirma == 'DIRECTA' ? const Color(0xFF10B981).withValues(alpha: 0.15) : const Color(0xFF0F172A),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: _metodoFirma == 'DIRECTA' ? const Color(0xFF10B981) : Colors.white.withValues(alpha: 0.08),
                                width: _metodoFirma == 'DIRECTA' ? 1.5 : 1,
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.gesture_rounded, size: 16, color: _metodoFirma == 'DIRECTA' ? const Color(0xFF10B981) : const Color(0xFF94A3B8)),
                                const SizedBox(width: 6),
                                Text(
                                  'Firma en Pantalla',
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: _metodoFirma == 'DIRECTA' ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _metodoFirma = 'SIN_FIRMA'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: _metodoFirma == 'SIN_FIRMA' ? const Color(0xFFEF4444).withValues(alpha: 0.15) : const Color(0xFF0F172A),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: _metodoFirma == 'SIN_FIRMA' ? const Color(0xFFEF4444) : Colors.white.withValues(alpha: 0.08),
                                width: _metodoFirma == 'SIN_FIRMA' ? 1.5 : 1,
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.block_rounded, size: 16, color: _metodoFirma == 'SIN_FIRMA' ? const Color(0xFFEF4444) : const Color(0xFF94A3B8)),
                                const SizedBox(width: 6),
                                Text(
                                  'Sin Firma (Excepción)',
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: _metodoFirma == 'SIN_FIRMA' ? const Color(0xFFEF4444) : const Color(0xFF94A3B8),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  if (_metodoFirma == 'DIRECTA') ...[
                    FirmaCanvasWidget(
                      key: _firmaKey,
                      height: 190,
                    ),
                  ] else ...[
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.25)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'MOTIVO JUSTIFICADO DE CIERRE SIN FIRMA *',
                            style: GoogleFonts.inter(fontSize: 10.5, fontWeight: FontWeight.w800, color: const Color(0xFFFCA5A5)),
                          ),
                          const SizedBox(height: 8),
                          _buildDropdownField(
                            label: 'Seleccione motivo',
                            value: _motivoSinFirma,
                            items: const [
                              {'id': 'TRABAJO_EXTERNO', 'nombre': 'Trabajo Externo (Poste / Caja NAP)'},
                              {'id': 'CLIENTE_AUSENTE', 'nombre': 'Cliente Ausente / No contesta'},
                              {'id': 'SOPORTE_REMOTO', 'nombre': 'Soporte Remoto / Lógico'},
                              {'id': 'TERCERA_EDAD_DISCAPACIDAD_SIN_FIRMA', 'nombre': 'Tercera Edad / Discapacidad'},
                              {'id': 'OTROS', 'nombre': 'Otros (especificar)'},
                            ],
                            onChanged: (val) => setState(() => _motivoSinFirma = val!),
                          ),
                          if (_motivoSinFirma == 'OTROS') ...[
                            const SizedBox(height: 10),
                            TextFormField(
                              controller: _motivoSinFirmaOtroController,
                              style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                              decoration: InputDecoration(
                                hintText: 'Explique por qué no se pudo recabar la firma...',
                                hintStyle: GoogleFonts.inter(color: const Color(0xFF64748B), fontSize: 12),
                                filled: true,
                                fillColor: const Color(0xFF0F172A),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 28),

            // BOTÓN DE FINALIZACIÓN Y REGISTRO TRANSACCIONAL
            Container(
              height: 56,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF10B981), Color(0xFF059669)],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF10B981).withValues(alpha: 0.4),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _finalizarVisita,
                icon: _isSubmitting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                      )
                    : const Icon(Icons.check_circle_rounded, color: Colors.white, size: 24),
                label: Text(
                  _isSubmitting ? 'GUARDANDO CIERRE Y COORDINADAS...' : 'FINALIZAR Y REGISTRAR VISITA',
                  style: GoogleFonts.outfit(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: 0.5,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ),

            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  // --- WIDGETS AUXILIARES DE UI ---
  Widget _buildSectionCard({
    required String title,
    required IconData icon,
    required Color color,
    required Widget child,
    Widget? action,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.outfit(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
              if (action != null) ...[
                const SizedBox(width: 8),
                action,
              ],
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _buildInputField({
    required String label,
    required TextEditingController controller,
    required String hint,
    bool isCode = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8)),
        ),
        const SizedBox(height: 4),
        TextFormField(
          controller: controller,
          style: isCode
              ? GoogleFonts.robotoMono(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)
              : GoogleFonts.inter(color: Colors.white, fontSize: 12.5),
          textCapitalization: isCode ? TextCapitalization.characters : TextCapitalization.sentences,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.inter(color: const Color(0xFF64748B), fontSize: 12),
            filled: true,
            fillColor: const Color(0xFF0F172A),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildDropdownField({
    required String label,
    required String value,
    required List<Map<String, String>> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isExpanded: true,
          dropdownColor: const Color(0xFF1E293B),
          items: items.map((i) {
            return DropdownMenuItem<String>(
              value: i['id'],
              child: Text(
                i['nombre']!,
                style: GoogleFonts.inter(color: Colors.white, fontSize: 12.5),
              ),
            );
          }).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _buildPhotoBox({
    required String title,
    required String subtitle,
    required XFile? file,
    required VoidCallback onTap,
    required VoidCallback onDelete,
  }) {
    return GestureDetector(
      onTap: file == null ? onTap : null,
      child: Container(
        height: 120,
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: file != null ? const Color(0xFF10B981) : Colors.white.withValues(alpha: 0.1),
            width: file != null ? 1.5 : 1,
          ),
        ),
        child: file != null
            ? Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(13),
                    child: FutureBuilder<List<int>>(
                      future: file.readAsBytes(),
                      builder: (ctx, snapshot) {
                        if (snapshot.hasData) {
                          return Image.memory(
                            snapshot.data as dynamic,
                            fit: BoxFit.cover,
                          );
                        }
                        return const Center(child: CircularProgressIndicator(strokeWidth: 2));
                      },
                    ),
                  ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: InkWell(
                      onTap: onDelete,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Colors.black87,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close_rounded, color: Colors.white, size: 16),
                      ),
                    ),
                  ),
                ],
              )
            : Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.add_a_photo_rounded, color: Color(0xFF38BDF8), size: 28),
                    const SizedBox(height: 6),
                    Text(
                      title,
                      style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: GoogleFonts.inter(fontSize: 10, color: const Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildExtraPhotoThumbnail({
    required int index,
    required XFile? file,
    required VoidCallback onTap,
    required VoidCallback onDelete,
  }) {
    return GestureDetector(
      onTap: file == null ? onTap : null,
      child: Container(
        height: 75,
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: file != null ? const Color(0xFF34D399) : Colors.white.withValues(alpha: 0.1),
          ),
        ),
        child: file != null
            ? Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(9),
                    child: FutureBuilder<List<int>>(
                      future: file.readAsBytes(),
                      builder: (ctx, snapshot) {
                        if (snapshot.hasData) {
                          return Image.memory(snapshot.data as dynamic, fit: BoxFit.cover);
                        }
                        return const Center(child: CircularProgressIndicator(strokeWidth: 1.5));
                      },
                    ),
                  ),
                  Positioned(
                    top: 2,
                    right: 2,
                    child: InkWell(
                      onTap: onDelete,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(color: Colors.black87, shape: BoxShape.circle),
                        child: const Icon(Icons.close, color: Colors.white, size: 12),
                      ),
                    ),
                  ),
                ],
              )
            : Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.camera_alt_outlined, color: Color(0xFF64748B), size: 20),
                    const SizedBox(height: 2),
                    Text(
                      '+$index',
                      style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: const Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
