import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/visita_model.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import 'cierre_visita_screen.dart';

class VisitaDetalleScreen extends StatefulWidget {
  final VisitaModel visita;
  final VoidCallback onRefresh;
  final List<dynamic> soluciones;
  final List<dynamic> catalogoMateriales;
  final List<dynamic> catalogoOnt;
  final List<dynamic> catalogoRouter;

  const VisitaDetalleScreen({
    super.key,
    required this.visita,
    required this.onRefresh,
    this.soluciones = const [],
    this.catalogoMateriales = const [],
    this.catalogoOnt = const [],
    this.catalogoRouter = const [],
  });

  @override
  State<VisitaDetalleScreen> createState() => _VisitaDetalleScreenState();
}

class _VisitaDetalleScreenState extends State<VisitaDetalleScreen> {
  late VisitaModel _visita;
  bool _actionLoading = false;

  // SmartOLT Live Diagnosis State
  final TextEditingController _snController = TextEditingController();
  bool _isMeasuringOlt = false;
  String? _oltError;
  Map<String, dynamic>? _oltResult;
  bool _showPassword = false;

  @override
  void initState() {
    super.initState();
    _visita = widget.visita;
    final initialSn = _visita.numeroSerie;
    if (initialSn != null &&
        initialSn.isNotEmpty &&
        initialSn.toUpperCase() != 'S/N' &&
        initialSn.toUpperCase() != 'NONE' &&
        initialSn.toUpperCase() != 'NULL') {
      _snController.text = initialSn.trim();
    }
  }

  @override
  void dispose() {
    _snController.dispose();
    super.dispose();
  }

  // --- ACCIÓN LLAMADA TELEFÓNICA ---
  Future<void> _makePhoneCall(String rawPhone) async {
    final clean = rawPhone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (clean.isEmpty) return;
    final Uri launchUri = Uri(scheme: 'tel', path: clean);
    if (await canLaunchUrl(launchUri)) {
      await launchUrl(launchUri);
    }
  }

  // --- ACCIÓN WHATSAPP DIRECTO ---
  Future<void> _openWhatsApp(String rawPhone, String cliente, int idVisita) async {
    // Buscar números en la cadena (pueden venir separados por comas o barras)
    final numbers = rawPhone.split(RegExp(r'[,/\s]+'));
    String? validCell;

    for (final num in numbers) {
      final clean = num.replaceAll(RegExp(r'[^0-9]'), '');
      if (clean.startsWith('09') && clean.length == 10) {
        validCell = '593${clean.substring(1)}';
        break;
      } else if (clean.startsWith('9') && clean.length == 9) {
        validCell = '593$clean';
        break;
      } else if (clean.startsWith('5939') && clean.length == 12) {
        validCell = clean;
        break;
      }
    }

    // Fallback: si no se detectó móvil con 09, usar el primer número limpio
    if (validCell == null && numbers.isNotEmpty) {
      final clean = numbers.first.replaceAll(RegExp(r'[^0-9]'), '');
      if (clean.isNotEmpty) {
        validCell = clean.startsWith('0') ? '593${clean.substring(1)}' : '593$clean';
      }
    }

    if (validCell == null || validCell.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('⚠️ No se encontró un número telefónico válido para WhatsApp'),
            backgroundColor: Color(0xFFF59E0B),
          ),
        );
      }
      return;
    }

    final mensaje =
        'Hola $cliente, le saluda el personal técnico de Futurity Internet. Estamos en camino a su domicilio para atender su solicitud técnica (Ticket VT-$idVisita).';
    final urlString = 'https://wa.me/$validCell?text=${Uri.encodeComponent(mensaje)}';
    final uri = Uri.parse(urlString);

    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('No se pudo abrir WhatsApp: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  // --- ACCIÓN MAPA GPS ---
  Future<void> _openMap(double? lat, double? lon, String direccion) async {
    if (lat != null && lon != null) {
      final googleUrl = Uri.parse('google.navigation:q=$lat,$lon');
      final fallbackUrl = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lon');
      if (await canLaunchUrl(googleUrl)) {
        await launchUrl(googleUrl);
      } else if (await canLaunchUrl(fallbackUrl)) {
        await launchUrl(fallbackUrl, mode: LaunchMode.externalApplication);
      }
    } else if (direccion.isNotEmpty) {
      final searchUrl = Uri.parse(
          'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent('$direccion, Cuenca, Ecuador')}');
      if (await canLaunchUrl(searchUrl)) {
        await launchUrl(searchUrl, mode: LaunchMode.externalApplication);
      }
    }
  }

  // --- INICIAR RUTA Y SEGUIMIENTO GPS ---
  Future<void> _handleIniciarRuta() async {
    setState(() => _actionLoading = true);

    await LocationTrackingService.startTracking(_visita.idVisita);
    await ApiService.iniciarRuta(_visita.idVisita);

    if (mounted) {
      setState(() => _actionLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('🚗 Ruta iniciada. GPS transmitiendo en segundo plano a la central.'),
          backgroundColor: Color(0xFF10B981),
        ),
      );
      widget.onRefresh();
      Navigator.pop(context);
    }
  }

  // --- ABRIR CIERRE TÉCNICO DE VISITA ---
  Future<void> _handleAbrirCierre() async {
    final bool? cerrado = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (context) => CierreVisitaScreen(
          visita: _visita,
          soluciones: widget.soluciones,
          catalogoMateriales: widget.catalogoMateriales,
          catalogoOnt: widget.catalogoOnt,
          catalogoRouter: widget.catalogoRouter,
        ),
      ),
    );

    if (cerrado == true) {
      widget.onRefresh();
      if (mounted) {
        Navigator.pop(context);
      }
    }
  }

  // --- POSPONER VISITA ---
  Future<void> _handlePosponerVisita() async {
    String motivo = 'Cliente solicita reagendar para otra fecha';
    final detalleController = TextEditingController();

    final bool? confirmado = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E293B),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  const Icon(Icons.schedule_rounded, color: Color(0xFFF59E0B), size: 24),
                  const SizedBox(width: 8),
                  Text(
                    'Posponer Visita',
                    style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'La visita volverá a Pendiente para que Call Center / Coordinación la reprograme.',
                      style: GoogleFonts.inter(color: const Color(0xFF94A3B8), fontSize: 12.5),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Motivo:',
                      style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      initialValue: motivo,
                      dropdownColor: const Color(0xFF0F172A),
                      isExpanded: true,
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      ),
                      style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                      items: const [
                        DropdownMenuItem(
                          value: 'Cliente solicita reagendar para otra fecha',
                          child: Text('📅 Cliente solicita reagendar para otra fecha'),
                        ),
                        DropdownMenuItem(
                          value: 'Cliente ausente',
                          child: Text('👤 Cliente ausente / No contesta'),
                        ),
                        DropdownMenuItem(
                          value: 'Saturación del día / Fin de jornada',
                          child: Text('⏳ Saturación del día / Fin de jornada'),
                        ),
                        DropdownMenuItem(
                          value: 'Dirección incorrecta / Difícil acceso',
                          child: Text('📍 Dirección incorrecta / Difícil acceso'),
                        ),
                        DropdownMenuItem(
                          value: 'Falta de materiales o herramientas',
                          child: Text('🛠️ Falta de materiales o herramientas'),
                        ),
                        DropdownMenuItem(
                          value: 'Otro motivo',
                          child: Text('❓ Otro motivo'),
                        ),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() => motivo = val);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    Text(
                      motivo == 'Cliente solicita reagendar para otra fecha'
                          ? 'Fecha / Horario que solicita el cliente:'
                          : 'Detalle o justificación:',
                      style: GoogleFonts.inter(
                        color: motivo == 'Cliente solicita reagendar para otra fecha'
                            ? const Color(0xFFF59E0B)
                            : Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 12.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: detalleController,
                      style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                      maxLines: 2,
                      decoration: InputDecoration(
                        hintText: motivo == 'Cliente solicita reagendar para otra fecha'
                            ? 'Ej: Lunes 14/09 desde las 8:00am hasta 9:30am...'
                            : 'Explica brevemente la razón...',
                        hintStyle: GoogleFonts.inter(color: const Color(0xFF64748B), fontSize: 12),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: Text('Cancelar', style: GoogleFonts.inter(color: const Color(0xFF94A3B8), fontWeight: FontWeight.w700)),
                ),
                ElevatedButton(
                  onPressed: () {
                    if (motivo == 'Cliente solicita reagendar para otra fecha' && detalleController.text.trim().isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Por favor indica la fecha/horario que solicita el cliente')),
                      );
                      return;
                    }
                    Navigator.pop(ctx, true);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF59E0B),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text('Posponer', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w800)),
                ),
              ],
            );
          },
        );
      },
    );

    if (confirmado == true) {
      setState(() => _actionLoading = true);
      String motivoFinal = motivo;
      if (motivo == 'Cliente solicita reagendar para otra fecha') {
        motivoFinal = 'Cliente solicita reagendar: ${detalleController.text.trim()}';
      }

      LocationTrackingService.stopTracking();
      final res = await ApiService.posponerVisita(
        _visita.idVisita,
        motivoFinal,
        detalle: detalleController.text.trim(),
      );

      if (mounted) {
        setState(() => _actionLoading = false);
        if (res['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Visita pospuesta. Call Center la revisará para reagendar.'),
              backgroundColor: Color(0xFFF59E0B),
            ),
          );
          widget.onRefresh();
          Navigator.pop(context);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(res['message'] ?? 'Error al posponer visita'),
              backgroundColor: const Color(0xFFEF4444),
            ),
          );
        }
      }
    }
  }

  // --- CONSULTAR SMARTOLT EN VIVO ---
  Future<void> _ejecutarDiagnosticoSmartOlt() async {
    final sn = _snController.text.trim();
    if (sn.isEmpty || sn.toUpperCase() == 'S/N') {
      setState(() {
        _oltError = 'Por favor ingresa o confirma el número de serie (SN) de la ONT a diagnosticar.';
      });
      return;
    }

    setState(() {
      _isMeasuringOlt = true;
      _oltError = null;
      _oltResult = null;
    });

    final res = await ApiService.getDiagnosticoSmartOlt(sn);

    if (!mounted) return;

    if (res['success'] == true && res['diagnostico'] != null) {
      setState(() {
        _oltResult = res['diagnostico'] as Map<String, dynamic>;
        _isMeasuringOlt = false;
      });
    } else {
      setState(() {
        _oltError = res['message'] ?? 'No se pudo obtener el diagnóstico del equipo en la OLT.';
        _isMeasuringOlt = false;
      });
    }
  }

  // --- SEMÁFORO Y CÁLCULO DE POTENCIA ÓPTICA ---
  Map<String, dynamic> _getSignalProps(String? valStr) {
    if (valStr == null ||
        valStr.isEmpty ||
        valStr == 'N/D' ||
        valStr == '-' ||
        valStr.toUpperCase() == 'DESCONECTADO') {
      return {
        'pct': 0.0,
        'color': const Color(0xFFEF4444),
        'label': '🔴 Desconectado / Sin Señal',
      };
    }

    final reg = RegExp(r'-?\d+(\.\d+)?');
    final match = reg.firstMatch(valStr);
    if (match == null) {
      return {
        'pct': 0.0,
        'color': const Color(0xFF64748B),
        'label': valStr,
      };
    }

    final val = double.tryParse(match.group(0) ?? '') ?? 0.0;
    if (val >= -25.99 && val <= -14.00) {
      return {
        'pct': 0.9,
        'color': const Color(0xFF10B981),
        'label': '🟢 Excelente ($val dBm) - Nivel Óptimo',
      };
    } else if (val >= -28.99 && val < -25.99) {
      return {
        'pct': 0.55,
        'color': const Color(0xFFF59E0B),
        'label': '🟡 Atenuado ($val dBm) - Alerta de Pérdida',
      };
    } else {
      return {
        'pct': 0.25,
        'color': const Color(0xFFEF4444),
        'label': '🔴 Crítico ($val dBm) - Doblez o Falla Física',
      };
    }
  }

  @override
  Widget build(BuildContext context) {
    bool isTrackingThis =
        LocationTrackingService.isTracking && LocationTrackingService.activeVisitaId == _visita.idVisita;

    final primaryPhone = _visita.telefonos.split(RegExp(r'[,/]')).first.trim();

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Ticket #${_visita.numeroParada} (VT-${_visita.idVisita})',
          style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. FICHA PRINCIPAL DEL CLIENTE
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF38BDF8).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'CONTRATO: ${_visita.contrato}',
                          style: GoogleFonts.inter(
                              fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF38BDF8)),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: _visita.estado == 'EN_RUTA'
                              ? const Color(0xFF38BDF8).withValues(alpha: 0.2)
                              : _visita.estado == 'FINALIZADA'
                                  ? const Color(0xFF10B981).withValues(alpha: 0.2)
                                  : const Color(0xFFF59E0B).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _visita.estado,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: _visita.estado == 'EN_RUTA'
                                ? const Color(0xFF38BDF8)
                                : _visita.estado == 'FINALIZADA'
                                    ? const Color(0xFF34D399)
                                    : const Color(0xFFFBBF24),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _visita.cliente,
                    style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white),
                  ),
                  if (_visita.cedula != null && _visita.cedula!.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      'C.I.: ${_visita.cedula}',
                      style: GoogleFonts.robotoMono(
                          fontSize: 12, color: const Color(0xFF94A3B8), fontWeight: FontWeight.w600),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.location_on_rounded, size: 16, color: Color(0xFF38BDF8)),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          _visita.direccion.isNotEmpty ? _visita.direccion : _visita.sector,
                          style: GoogleFonts.inter(
                              fontSize: 12.5, fontWeight: FontWeight.w600, color: const Color(0xFFCBD5E1)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.access_time_rounded, size: 16, color: Color(0xFFF59E0B)),
                      const SizedBox(width: 4),
                      Text(
                        _visita.preferenciaHoraria,
                        style: GoogleFonts.inter(
                            fontSize: 12.5, fontWeight: FontWeight.w700, color: const Color(0xFFFBBF24)),
                      ),
                      if (_visita.antiguedadFmt != null) ...[
                        const SizedBox(width: 12),
                        const Icon(Icons.history_rounded, size: 16, color: Color(0xFF94A3B8)),
                        const SizedBox(width: 4),
                        Text(
                          _visita.antiguedadFmt!,
                          style: GoogleFonts.inter(
                              fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF94A3B8)),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 14),

            // 2. ACCIONES RÁPIDAS: GPS, WHATSAPP, LLAMAR
            Row(
              children: [
                // GPS
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _openMap(_visita.latitud, _visita.longitud, _visita.direccion),
                    icon: const Icon(Icons.navigation_rounded, color: Colors.white, size: 16),
                    label: Text('GPS', style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 12.5)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // WHATSAPP
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _visita.telefonos.isNotEmpty
                        ? () => _openWhatsApp(_visita.telefonos, _visita.cliente, _visita.idVisita)
                        : null,
                    icon: const Icon(Icons.chat_rounded, color: Colors.white, size: 16),
                    label: Text('WHATSAPP', style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 12)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // LLAMAR
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: primaryPhone.isNotEmpty ? () => _makePhoneCall(primaryPhone) : null,
                    icon: const Icon(Icons.phone_in_talk_rounded, color: Colors.white, size: 16),
                    label: Text('LLAMAR', style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 12.5)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0D9488),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 14),

            // 3. TARJETA DE DIAGNÓSTICO SMARTOLT EN VIVO
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: _oltResult != null && _oltResult!['estado']?.toString().toLowerCase() == 'online'
                      ? const Color(0xFF10B981).withValues(alpha: 0.4)
                      : const Color(0xFF38BDF8).withValues(alpha: 0.2),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF38BDF8).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.settings_input_antenna_rounded,
                                size: 18, color: Color(0xFF38BDF8)),
                          ),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'DIAGNÓSTICO SMARTOLT',
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF38BDF8),
                                  letterSpacing: 0.5,
                                ),
                              ),
                              Text(
                                'Potencia Óptica en Vivo',
                                style: GoogleFonts.outfit(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      if (_oltResult != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: _oltResult!['estado']?.toString().toLowerCase() == 'online'
                                ? const Color(0xFF10B981).withValues(alpha: 0.2)
                                : const Color(0xFFEF4444).withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: _oltResult!['estado']?.toString().toLowerCase() == 'online'
                                      ? const Color(0xFF34D399)
                                      : const Color(0xFFEF4444),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                _oltResult!['estado']?.toString().toUpperCase() ?? 'N/D',
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  color: _oltResult!['estado']?.toString().toLowerCase() == 'online'
                                      ? const Color(0xFF34D399)
                                      : const Color(0xFFF87171),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  // Input de Serial ONT con botón de medición
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 48,
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                          ),
                          child: TextField(
                            controller: _snController,
                            style: GoogleFonts.robotoMono(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                            textCapitalization: TextCapitalization.characters,
                            decoration: InputDecoration(
                              hintText: 'SN de la ONT (ej: ZTEGC8...)',
                              hintStyle: GoogleFonts.inter(color: const Color(0xFF64748B), fontSize: 12),
                              prefixIcon:
                                  const Icon(Icons.qr_code_2_rounded, color: Color(0xFF38BDF8), size: 20),
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: _isMeasuringOlt ? null : _ejecutarDiagnosticoSmartOlt,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0284C7),
                          disabledBackgroundColor: const Color(0xFF0284C7).withValues(alpha: 0.5),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        ),
                        child: _isMeasuringOlt
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : Row(
                                children: [
                                  const Icon(Icons.bolt_rounded, color: Colors.white, size: 18),
                                  const SizedBox(width: 4),
                                  Text('MEDIR',
                                      style: GoogleFonts.outfit(
                                          fontWeight: FontWeight.w800, fontSize: 12.5, color: Colors.white)),
                                ],
                              ),
                      ),
                    ],
                  ),

                  // Error de OLT
                  if (_oltError != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline_rounded, color: Color(0xFFF87171), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _oltError!,
                              style: GoogleFonts.inter(
                                  color: const Color(0xFFFCA5A5), fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Spinner de medición
                  if (_isMeasuringOlt) ...[
                    const SizedBox(height: 16),
                    Center(
                      child: Column(
                        children: [
                          const CircularProgressIndicator(color: Color(0xFF38BDF8)),
                          const SizedBox(height: 10),
                          Text(
                            'Consultando central OLT y midiendo potencia de fibra...',
                            style: GoogleFonts.inter(color: const Color(0xFF94A3B8), fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Resultados del Diagnóstico
                  if (_oltResult != null && !_isMeasuringOlt) ...[
                    const SizedBox(height: 16),

                    // Tarjetas de Potencia RX / TX
                    Row(
                      children: [
                        // RX (Bajada)
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0F172A),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'ENGANCHE (RX)',
                                  style: GoogleFonts.inter(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFF94A3B8),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _oltResult!['potencia_rx'] ?? 'N/D',
                                  style: GoogleFonts.outfit(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        // TX (Retorno)
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0F172A),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'RETORNO (TX)',
                                  style: GoogleFonts.inter(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFF94A3B8),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _oltResult!['potencia_tx'] ?? 'N/D',
                                  style: GoogleFonts.outfit(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w900,
                                    color: const Color(0xFF94A3B8),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // Barra visual y Semáforo RX
                    (() {
                      final rxProps = _getSignalProps(_oltResult!['potencia_rx']);
                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'SEÑAL ÓPTICA EN TERRENO',
                                  style: GoogleFonts.inter(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFF94A3B8),
                                  ),
                                ),
                                Text(
                                  rxProps['label'] as String,
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: rxProps['color'] as Color,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: LinearProgressIndicator(
                                value: (rxProps['pct'] as double),
                                minHeight: 8,
                                backgroundColor: Colors.white.withValues(alpha: 0.08),
                                valueColor: AlwaysStoppedAnimation<Color>(rxProps['color'] as Color),
                              ),
                            ),
                          ],
                        ),
                      );
                    })(),

                    const SizedBox(height: 12),

                    // Grid de Parámetros OLT / PON / NAP
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                      ),
                      child: Column(
                        children: [
                          _buildOltMetaRow('Central OLT', _oltResult!['olt_name'] ?? 'N/D'),
                          const Divider(color: Colors.white10, height: 14),
                          _buildOltMetaRow('Puerto PON', _oltResult!['pon_port'] ?? 'N/D'),
                          const Divider(color: Colors.white10, height: 14),
                          _buildOltMetaRow('Caja NAP (ODB)', _oltResult!['caja_nap'] ?? 'N/D'),
                          const Divider(color: Colors.white10, height: 14),
                          _buildOltMetaRow('Distancia Fibra', _oltResult!['distancia'] ?? 'N/D'),
                          const Divider(color: Colors.white10, height: 14),
                          _buildOltMetaRow('Uptime Conexión', _oltResult!['uptime'] ?? 'N/D'),
                          const Divider(color: Colors.white10, height: 14),
                          _buildOltMetaRow('IP WAN', _oltResult!['ip_wan'] ?? 'N/D'),
                          const Divider(color: Colors.white10, height: 14),
                          _buildOltMetaRow('VLAN', _oltResult!['vlan'] ?? 'N/D'),
                          const Divider(color: Colors.white10, height: 14),
                          _buildOltMetaRow('Modelo Detectado', _oltResult!['modelo'] ?? 'N/D'),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 4. MOTIVO DEL REQUERIMIENTO
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'MOTIVO DEL REQUERIMIENTO',
                    style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8)),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _visita.problema,
                    style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: const Color(0xFFF87171)),
                  ),
                  if (_visita.observacionCallcenter.isNotEmpty) ...[
                    const Divider(color: Colors.white10, height: 24),
                    Text(
                      'OBSERVACIÓN CALL CENTER',
                      style: GoogleFonts.inter(
                          fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8)),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _visita.observacionCallcenter,
                      style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFFCBD5E1), height: 1.4),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 5. EQUIPOS INSTALADOS EN DOMICILIO
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.devices_rounded, size: 18, color: Color(0xFF38BDF8)),
                      const SizedBox(width: 8),
                      Text(
                        'EQUIPOS INSTALADOS EN DOMICILIO',
                        style: GoogleFonts.inter(
                            fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF38BDF8)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // ONT
                  _buildEquipoRow(
                    icon: Icons.router_rounded,
                    titulo: 'ONT / Módem Fibra',
                    modelo: _visita.modeloOnt ?? 'ONT Estándar',
                    serial: _visita.numeroSerie ?? 'S/N',
                  ),
                  const Divider(color: Colors.white10, height: 18),

                  // Router Principal
                  _buildEquipoRow(
                    icon: Icons.wifi_rounded,
                    titulo: 'Router Principal',
                    modelo: _visita.routerPrincipal ?? 'Router WiFi',
                    serial: _visita.numeroSerieRouter ?? 'S/N',
                  ),

                  // Router Secundario / Mesh si existe
                  if (_visita.routerSecundario != null && _visita.routerSecundario!.isNotEmpty) ...[
                    const Divider(color: Colors.white10, height: 18),
                    _buildEquipoRow(
                      icon: Icons.hub_rounded,
                      titulo: 'Router Secundario (${_visita.tipoMesh ?? 'Mesh'})',
                      modelo: _visita.routerSecundario!,
                      serial: _visita.numeroSerieRouterSecundario ?? 'S/N',
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 6. DATOS TÉCNICOS & RED (PPPoE, Caja NAP, Hilo, IP, VLAN)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.dns_rounded, size: 18, color: Color(0xFF38BDF8)),
                      const SizedBox(width: 8),
                      Text(
                        'DATOS DE CONEXIÓN & RED',
                        style: GoogleFonts.inter(
                            fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF38BDF8)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Grid de Datos Técnicos
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                    ),
                    child: Column(
                      children: [
                        _buildOltMetaRow('Caja NAP', _visita.infoCaja ?? 'N/D'),
                        const Divider(color: Colors.white10, height: 14),
                        _buildOltMetaRow('Hilo Fibra', _visita.infoHilo ?? 'N/D'),
                        const Divider(color: Colors.white10, height: 14),
                        _buildOltMetaRow('IP Cliente', _visita.infoIp ?? 'N/D'),
                        const Divider(color: Colors.white10, height: 14),
                        _buildOltMetaRow('VLAN', _visita.infoVlan ?? 'N/D'),
                        const Divider(color: Colors.white10, height: 14),
                        _buildOltMetaRow('Usuario PPPoE', _visita.infoUsr ?? 'N/D'),
                        if (_visita.infoPas != null && _visita.infoPas!.isNotEmpty) ...[
                          const Divider(color: Colors.white10, height: 14),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Contraseña PPPoE',
                                style: GoogleFonts.inter(
                                    fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF94A3B8)),
                              ),
                              Row(
                                children: [
                                  Text(
                                    _showPassword ? _visita.infoPas! : '••••••••',
                                    style: GoogleFonts.robotoMono(
                                        fontSize: 12.5, fontWeight: FontWeight.w700, color: Colors.white),
                                  ),
                                  const SizedBox(width: 6),
                                  GestureDetector(
                                    onTap: () => setState(() => _showPassword = !_showPassword),
                                    child: Icon(
                                      _showPassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                                      size: 16,
                                      color: const Color(0xFF38BDF8),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Si hay información en texto libre
                  if (_visita.informacionTecnico != null && _visita.informacionTecnico!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      'NOTAS TÉCNICAS ADICIONALES',
                      style: GoogleFonts.inter(
                          fontSize: 10, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8)),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                      ),
                      child: Text(
                        _visita.informacionTecnico!,
                        style: GoogleFonts.robotoMono(fontSize: 12, color: const Color(0xFFE2E8F0)),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 24),

            // 7. BOTÓN DE INICIO DE RUTA / RASTREO
            if (_visita.estado == 'PENDIENTE')
              Container(
                height: 54,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF38BDF8), Color(0xFF2563EB)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF2563EB).withValues(alpha: 0.4),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    )
                  ],
                ),
                child: ElevatedButton.icon(
                  onPressed: _actionLoading ? null : _handleIniciarRuta,
                  icon: _actionLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Icon(Icons.local_shipping_rounded, color: Colors.white, size: 22),
                  label: Text(
                    'INICIAR RUTA Y RASTREO GPS',
                    style: GoogleFonts.outfit(fontSize: 14.5, fontWeight: FontWeight.w800, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),

            if (isTrackingThis)
              Container(
                margin: const EdgeInsets.only(top: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.gps_fixed_rounded, color: Color(0xFF34D399), size: 18),
                    const SizedBox(width: 8),
                    Text(
                      'Rastreo activo en segundo plano',
                      style: GoogleFonts.inter(
                          color: const Color(0xFF34D399), fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                  ],
                ),
              ),

            // 8. BOTÓN PARA FINALIZAR Y CERRAR VISITA TÉCNICA
            if (_visita.estado != 'FINALIZADA') ...[
              const SizedBox(height: 12),
              Container(
                height: 54,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF10B981), Color(0xFF059669)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF10B981).withValues(alpha: 0.35),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: ElevatedButton.icon(
                  onPressed: _handleAbrirCierre,
                  icon: const Icon(Icons.check_circle_rounded, color: Colors.white, size: 22),
                  label: Text(
                    'FINALIZAR / CERRAR VISITA',
                    style: GoogleFonts.outfit(fontSize: 14.5, fontWeight: FontWeight.w800, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _actionLoading ? null : _handlePosponerVisita,
                icon: const Icon(Icons.schedule_rounded, color: Color(0xFFF59E0B), size: 18),
                label: Text(
                  'POSPONER / REAGENDAR VISITA',
                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w800, color: const Color(0xFFF59E0B)),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFFF59E0B), width: 1.5),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildOltMetaRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(
              label,
              style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF94A3B8)),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 6,
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: GoogleFonts.inter(fontSize: 12.5, fontWeight: FontWeight.w700, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEquipoRow({
    required IconData icon,
    required String titulo,
    required String modelo,
    required String serial,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: const Color(0xFF38BDF8).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: const Color(0xFF38BDF8), size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                titulo,
                style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: const Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 2),
              Text(
                modelo,
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
              ),
              const SizedBox(height: 2),
              Text(
                'SN: $serial',
                style: GoogleFonts.robotoMono(
                    fontSize: 11.5, fontWeight: FontWeight.w700, color: const Color(0xFF38BDF8)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
