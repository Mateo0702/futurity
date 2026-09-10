import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import 'login_screen.dart';

class PerfilTecnicoScreen extends StatefulWidget {
  final String tecnicoNombre;
  final String areaTrabajo;
  final String fotoPerfil;
  final String estadoActividad;
  final VoidCallback onLogout;

  const PerfilTecnicoScreen({
    super.key,
    required this.tecnicoNombre,
    required this.areaTrabajo,
    required this.fotoPerfil,
    required this.estadoActividad,
    required this.onLogout,
  });

  @override
  State<PerfilTecnicoScreen> createState() => _PerfilTecnicoScreenState();
}

class _PerfilTecnicoScreenState extends State<PerfilTecnicoScreen> {
  late String _estadoActividad;
  bool _alertaPanicoActiva = false;
  bool _isProcessing = false;
  final String _numeroGrua = "0958672088";

  @override
  void initState() {
    super.initState();
    _estadoActividad = widget.estadoActividad;
  }

  Future<void> _handleLlamarGrua() async {
    final url = Uri.parse('tel:$_numeroGrua');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Llamar a Grúa / Auxilio: $_numeroGrua')),
      );
    }
  }

  void _showPanicoModal() {
    String motivo = 'Vehículo Varado (Falla Mecánica)';
    String detalle = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, color: Color(0xFFF87171), size: 28),
                      const SizedBox(width: 10),
                      Text('ALERTA DE EMERGENCIA', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w900, color: const Color(0xFFF87171))),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('Se enviará una notificación prioritaria con tus coordenadas GPS actuales a la Central.', style: GoogleFonts.inter(fontSize: 12.5, color: const Color(0xFF94A3B8))),
                  const SizedBox(height: 16),

                  Text('Motivo de Emergencia:', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white10)),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        dropdownColor: const Color(0xFF0F172A),
                        value: motivo,
                        isExpanded: true,
                        items: const [
                          DropdownMenuItem(value: 'Vehículo Varado (Falla Mecánica)', child: Text('🚗 Vehículo Varado (Falla Mecánica)', style: TextStyle(color: Colors.white, fontSize: 13))),
                          DropdownMenuItem(value: 'Accidente de Tránsito', child: Text('⚠️ Accidente de Tránsito', style: TextStyle(color: Colors.white, fontSize: 13))),
                          DropdownMenuItem(value: 'Riesgo de Seguridad / Asalto', child: Text('🚨 Riesgo de Seguridad / Asalto', style: TextStyle(color: Colors.white, fontSize: 13))),
                          DropdownMenuItem(value: 'Otro inconveniente grave', child: Text('❓ Otro inconveniente grave', style: TextStyle(color: Colors.white, fontSize: 13))),
                        ],
                        onChanged: (val) {
                          if (val != null) setModalState(() => motivo = val);
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  Text('Detalle adicional (opcional):', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 6),
                  TextFormField(
                    maxLines: 2,
                    style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Ubicación de referencia o mensaje extra...',
                      hintStyle: GoogleFonts.inter(color: Colors.white38),
                      filled: true,
                      fillColor: const Color(0xFF0F172A),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.white10)),
                    ),
                    onChanged: (val) => detalle = val,
                  ),
                  const SizedBox(height: 20),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF87171),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(Icons.emergency_rounded, color: Colors.white),
                      label: Text('ACTIVAR BOTÓN DE PÁNICO', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 15)),
                      onPressed: () async {
                        Navigator.pop(context);
                        setState(() => _isProcessing = true);

                        final res = await ApiService.activarPanico(motivo, detalle: detalle);
                        if (!mounted) return;
                        setState(() => _isProcessing = false);

                        if (res['success'] == true) {
                          setState(() => _alertaPanicoActiva = true);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(res['message'] ?? 'Alerta de pánico activada. Central notificada.'), backgroundColor: const Color(0xFFF87171)),
                          );
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(res['message'] ?? 'Error al activar pánico'), backgroundColor: const Color(0xFFF87171)),
                          );
                        }
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _desactivarPanico() async {
    setState(() => _isProcessing = true);
    final res = await ApiService.desactivarPanico();
    if (!mounted) return;
    setState(() => _isProcessing = false);

    if (res['success'] == true) {
      setState(() => _alertaPanicoActiva = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res['message'] ?? 'Alerta de pánico resuelta/desactivada.'), backgroundColor: const Color(0xFF10B981)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    bool isTracking = LocationTrackingService.isTracking;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Text('Mi Perfil & Seguridad', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
      ),
      body: _isProcessing
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  // Profile Card Header
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
                    ),
                    child: Column(
                      children: [
                        CircleAvatar(
                          radius: 40,
                          backgroundColor: const Color(0xFF38BDF8),
                          child: Text(
                            widget.tecnicoNombre.isNotEmpty ? widget.tecnicoNombre[0].toUpperCase() : 'T',
                            style: GoogleFonts.outfit(fontSize: 36, fontWeight: FontWeight.w900, color: Colors.white),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(widget.tecnicoNombre, style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
                        const SizedBox(height: 4),
                        Text(
                          widget.areaTrabajo == 'SOPORTE' ? '🛠️ Soporte Técnico Campo' : '🔌 Instalaciones',
                          style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8), fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Panico Banner if Active
                  if (_alertaPanicoActiva)
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: const Color(0xFFF87171).withValues(alpha: 0.2), borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFF87171))),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.warning_rounded, color: Color(0xFFF87171), size: 24),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text('¡ALERTA DE PÁNICO ACTIVA!', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, color: const Color(0xFFF87171), fontSize: 14)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
                            icon: const Icon(Icons.check_rounded, color: Colors.white),
                            label: const Text('Resolver / Desactivar Alerta', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            onPressed: _desactivarPanico,
                          )
                        ],
                      ),
                    ),

                  // Botón de Pánico Principal
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEF4444),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 4,
                      ),
                      icon: const Icon(Icons.emergency_rounded, color: Colors.white, size: 26),
                      label: Text('BOTÓN DE PÁNICO (EMERGENCIA)', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.white)),
                      onPressed: _showPanicoModal,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Opciones de Configuración y Servicios
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      children: [
                        // GPS Tracking Status
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(color: (isTracking ? const Color(0xFF10B981) : const Color(0xFF64748B)).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
                            child: Icon(Icons.gps_fixed_rounded, color: isTracking ? const Color(0xFF34D399) : const Color(0xFF94A3B8)),
                          ),
                          title: Text('Rastreo GPS en Segundo Plano', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                          subtitle: Text(isTracking ? 'Activo - Transmitiendo coordenadas' : 'Inactivo', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8))),
                          trailing: Switch(
                            value: isTracking,
                            activeColor: const Color(0xFF34D399),
                            onChanged: (val) {
                              setState(() {
                                if (val) {
                                  LocationTrackingService.startTracking();
                                } else {
                                  LocationTrackingService.stopTracking();
                                }
                              });
                            },
                          ),
                        ),
                        const Divider(color: Colors.white10),

                        // Llamar a Grúa / Auxilio
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(color: const Color(0xFFF59E0B).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
                            child: const Icon(Icons.car_repair_rounded, color: Color(0xFFFBBF24)),
                          ),
                          title: Text('Auxilio Mecánico / Grúa', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                          subtitle: Text('Tel: $_numeroGrua', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8))),
                          trailing: IconButton(
                            icon: const Icon(Icons.phone_in_talk_rounded, color: Color(0xFFFBBF24)),
                            onPressed: _handleLlamarGrua,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Cerrar Sesión
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFFF87171)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      icon: const Icon(Icons.logout_rounded, color: Color(0xFFF87171)),
                      label: Text('Cerrar Sesión', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: const Color(0xFFF87171))),
                      onPressed: () {
                        widget.onLogout();
                      },
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
