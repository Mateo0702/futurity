import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/visita_model.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import 'login_screen.dart';
import 'visita_detalle_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  String _tecnicoNombre = '';
  String _areaTrabajo = 'SOPORTE';
  List<VisitaModel> _visitas = [];
  List<dynamic> _materiales = [];
  List<dynamic> _soluciones = [];
  List<dynamic> _catalogoOnt = [];
  List<dynamic> _catalogoRouter = [];
  String? _errorMessage;
  String _selectedFilter = 'TODAS';

  List<VisitaModel> get _filteredVisitas {
    switch (_selectedFilter) {
      case 'PENDIENTES':
        return _visitas.where((v) => v.estado == 'PENDIENTE').toList();
      case 'EN_RUTA':
        return _visitas.where((v) => v.estado == 'EN_RUTA').toList();
      case 'FINALIZADAS':
        return _visitas.where((v) => v.estado == 'FINALIZADA').toList();
      default:
        return _visitas;
    }
  }

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await ApiService.getPanelTecnico();

    if (!mounted) return;

    if (result['success'] == true) {
      setState(() {
        _tecnicoNombre = result['tecnico']?['nombre'] ?? 'Técnico';
        _areaTrabajo = result['tecnico']?['area_trabajo'] ?? 'SOPORTE';
        _visitas = (result['visitas'] as List<VisitaModel>?) ?? [];
        _materiales = (result['materiales'] as List<dynamic>?) ?? [];
        _soluciones = (result['soluciones'] as List<dynamic>?) ?? [];
        _catalogoOnt = (result['catalogo_ont'] as List<dynamic>?) ?? [];
        _catalogoRouter = (result['catalogo_router'] as List<dynamic>?) ?? [];
        _isLoading = false;
      });
    } else {
      setState(() {
        _errorMessage = result['message'] ?? 'Error cargando datos';
        _isLoading = false;
      });
    }
  }

  Future<void> _handleLogout() async {
    LocationTrackingService.stopTracking();
    await ApiService.logout();
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => const LoginScreen()),
    );
  }

  Widget _buildFilterChip(String key, String label, int count, Color activeColor) {
    final isSelected = _selectedFilter == key;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedFilter = key;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? activeColor.withValues(alpha: 0.18) : const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? activeColor : Colors.white.withValues(alpha: 0.08),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 12.5,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? activeColor : const Color(0xFF94A3B8),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: isSelected ? activeColor : Colors.white.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '$count',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  color: isSelected ? Colors.black : const Color(0xFF94A3B8),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    bool isTracking = LocationTrackingService.isTracking;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: const Color(0xFF38BDF8),
              child: Text(
                _tecnicoNombre.isNotEmpty ? _tecnicoNombre[0].toUpperCase() : 'T',
                style: GoogleFonts.outfit(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 16),
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _tecnicoNombre.isEmpty ? 'Cargando...' : _tecnicoNombre,
                  style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
                ),
                Text(
                  _areaTrabajo == 'SOPORTE' ? '🛠️ Soporte Técnico' : '🔌 Instalaciones',
                  style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8), fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF38BDF8)),
            onPressed: _loadData,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFF87171)),
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: Column(
        children: [
          // Banner de GPS en segundo plano
          if (isTracking)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: const Color(0xFF10B981).withValues(alpha: 0.2),
              child: Row(
                children: [
                  const Icon(Icons.satellite_alt_rounded, color: Color(0xFF34D399), size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'GPS activo: Transmitiendo ubicación a la central',
                      style: GoogleFonts.inter(color: const Color(0xFF34D399), fontSize: 12.5, fontWeight: FontWeight.w700),
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        LocationTrackingService.stopTracking();
                      });
                    },
                    style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(50, 30)),
                    child: Text(
                      'Detener',
                      style: GoogleFonts.inter(color: const Color(0xFFF87171), fontWeight: FontWeight.w800, fontSize: 12),
                    ),
                  )
                ],
              ),
            ),

          // Header de resumen de ruta
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'RUTA DEL DÍA (${_visitas.length} PARADAS)',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF94A3B8),
                    letterSpacing: 0.8,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Text(
                    'Hoy',
                    style: GoogleFonts.inter(fontSize: 11.5, color: Colors.white, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),

          // Chips de Filtro por Estado
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('TODAS', 'Todas', _visitas.length, const Color(0xFF38BDF8)),
                  const SizedBox(width: 8),
                  _buildFilterChip('PENDIENTES', 'Pendientes', _visitas.where((v) => v.estado == 'PENDIENTE').length, const Color(0xFFFBBF24)),
                  const SizedBox(width: 8),
                  _buildFilterChip('EN_RUTA', 'En Ruta', _visitas.where((v) => v.estado == 'EN_RUTA').length, const Color(0xFF60A5FA)),
                  const SizedBox(width: 8),
                  _buildFilterChip('FINALIZADAS', 'Finalizadas', _visitas.where((v) => v.estado == 'FINALIZADA').length, const Color(0xFF34D399)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Listado de Visitas
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF38BDF8)),
                  )
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.wifi_off_rounded, color: Color(0xFFF87171), size: 48),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.inter(color: const Color(0xFFCBD5E1), fontSize: 14),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _loadData,
                                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8)),
                                child: const Text('Reintentar', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _filteredVisitas.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    _selectedFilter == 'FINALIZADAS'
                                        ? Icons.check_circle_outline_rounded
                                        : _selectedFilter == 'EN_RUTA'
                                            ? Icons.directions_car_filled_outlined
                                            : Icons.task_alt_rounded,
                                    color: _selectedFilter == 'EN_RUTA'
                                        ? const Color(0xFF60A5FA)
                                        : const Color(0xFF34D399),
                                    size: 54,
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    _selectedFilter == 'TODAS'
                                        ? '¡Excelente trabajo!'
                                        : _selectedFilter == 'PENDIENTES'
                                            ? 'Sin pendientes'
                                            : _selectedFilter == 'EN_RUTA'
                                                ? 'Sin visitas en ruta'
                                                : 'Sin visitas finalizadas',
                                    style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _selectedFilter == 'TODAS'
                                        ? 'No tienes visitas pendientes asignadas.'
                                        : _selectedFilter == 'PENDIENTES'
                                            ? 'No tienes visitas pendientes por iniciar.'
                                            : _selectedFilter == 'EN_RUTA'
                                                ? 'No tienes ninguna visita en trayecto actualmente.'
                                                : 'Aún no has concluido visitas el día de hoy.',
                                    textAlign: TextAlign.center,
                                    style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8)),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _loadData,
                            color: const Color(0xFF38BDF8),
                            child: ListView.builder(
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
                              itemCount: _filteredVisitas.length,
                              itemBuilder: (context, index) {
                                final v = _filteredVisitas[index];
                                final isFinished = v.estado == 'FINALIZADA';
                                final isEnRuta = v.estado == 'EN_RUTA';

                                return Container(
                                  margin: const EdgeInsets.only(bottom: 14),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF1E293B),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: isEnRuta
                                          ? const Color(0xFF38BDF8).withValues(alpha: 0.5)
                                          : Colors.white.withValues(alpha: 0.06),
                                      width: isEnRuta ? 1.5 : 1,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.2),
                                        blurRadius: 10,
                                        offset: const Offset(0, 4),
                                      )
                                    ],
                                  ),
                                  child: Material(
                                    color: Colors.transparent,
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(20),
                                      onTap: () {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (context) => VisitaDetalleScreen(
                                              visita: v,
                                              onRefresh: _loadData,
                                              soluciones: _soluciones,
                                              catalogoMateriales: _materiales,
                                              catalogoOnt: _catalogoOnt,
                                              catalogoRouter: _catalogoRouter,
                                            ),
                                          ),
                                        );
                                      },
                                      child: Padding(
                                        padding: const EdgeInsets.all(16),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            // Card Top: Parada Badge & Preferred Time
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Row(
                                                  children: [
                                                    Container(
                                                      width: 32,
                                                      height: 32,
                                                      decoration: BoxDecoration(
                                                        color: isFinished
                                                            ? const Color(0xFF10B981).withValues(alpha: 0.2)
                                                            : isEnRuta
                                                                ? const Color(0xFF38BDF8).withValues(alpha: 0.2)
                                                                : const Color(0xFF3B82F6).withValues(alpha: 0.2),
                                                        borderRadius: BorderRadius.circular(10),
                                                      ),
                                                      child: Center(
                                                        child: Text(
                                                          '#${v.numeroParada}',
                                                          style: GoogleFonts.outfit(
                                                            fontSize: 14,
                                                            fontWeight: FontWeight.w900,
                                                            color: isFinished
                                                                ? const Color(0xFF34D399)
                                                                : isEnRuta
                                                                    ? const Color(0xFF38BDF8)
                                                                    : const Color(0xFF60A5FA),
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                    const SizedBox(width: 10),
                                                    Text(
                                                      'VT-${v.idVisita}',
                                                      style: GoogleFonts.robotoMono(
                                                        fontSize: 13,
                                                        fontWeight: FontWeight.w700,
                                                        color: const Color(0xFF94A3B8),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                                                    borderRadius: BorderRadius.circular(8),
                                                  ),
                                                  child: Row(
                                                    children: [
                                                      const Icon(Icons.access_time_rounded, size: 13, color: Color(0xFFFBBF24)),
                                                      const SizedBox(width: 4),
                                                      Text(
                                                        v.preferenciaHoraria,
                                                        style: GoogleFonts.inter(
                                                          fontSize: 11.5,
                                                          fontWeight: FontWeight.w700,
                                                          color: const Color(0xFFFBBF24),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 12),

                                            // Client Name & Contract
                                            Text(
                                              v.cliente,
                                              style: GoogleFonts.outfit(
                                                fontSize: 16.5,
                                                fontWeight: FontWeight.w800,
                                                color: Colors.white,
                                              ),
                                            ),
                                            const SizedBox(height: 4),

                                            // Sector & Problem
                                            Row(
                                              children: [
                                                const Icon(Icons.location_on_rounded, size: 14, color: Color(0xFF38BDF8)),
                                                const SizedBox(width: 4),
                                                Text(
                                                  v.sector,
                                                  style: GoogleFonts.inter(
                                                    fontSize: 12.5,
                                                    fontWeight: FontWeight.w600,
                                                    color: const Color(0xFF38BDF8),
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                                Text('•', style: TextStyle(color: Colors.white.withValues(alpha: 0.3))),
                                                const SizedBox(width: 8),
                                                Expanded(
                                                  child: Text(
                                                    v.problema,
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                    style: GoogleFonts.inter(
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.w600,
                                                      color: const Color(0xFFF87171),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
