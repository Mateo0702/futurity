import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import 'home_screen.dart';
import 'inventario_vehiculo_screen.dart';
import 'mis_requisiciones_screen.dart';
import 'perfil_tecnico_screen.dart';
import 'login_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;
  bool _isLoading = true;
  String _tecnicoNombre = '';
  String _areaTrabajo = 'SOPORTE';
  String _fotoPerfil = 'default_avatar.png';
  String _estadoActividad = 'Disponible';
  String _placaVehiculo = 'S/P';
  List<dynamic> _materiales = [];
  List<dynamic> _tecnicosLista = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await ApiService.getPanelTecnico();
    if (!mounted) return;

    if (res['success'] == true) {
      setState(() {
        _tecnicoNombre = res['tecnico']?['nombre'] ?? 'Técnico';
        _areaTrabajo = res['tecnico']?['area_trabajo'] ?? 'SOPORTE';
        _fotoPerfil = res['tecnico']?['foto_perfil'] ?? 'default_avatar.png';
        _estadoActividad = res['tecnico']?['estado_actividad'] ?? 'Disponible';
        _materiales = (res['materiales'] as List<dynamic>?) ?? [];
        _tecnicosLista = (res['tecnicos_lista'] as List<dynamic>?) ?? [];
        _isLoading = false;
      });
    } else {
      setState(() {
        _errorMessage = res['message'] ?? 'Error al cargar datos del panel';
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

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0F172A),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF38BDF8)),
        ),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.wifi_off_rounded, color: Color(0xFFF87171), size: 54),
                const SizedBox(height: 16),
                Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(color: const Color(0xFFCBD5E1), fontSize: 15),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _loadInitialData,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF38BDF8),
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Reintentar', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final pages = [
      // 1. Agenda de Visitas (HomeScreen original)
      const HomeScreen(),

      // 2. Inventario Vehículo
      InventarioVehiculoScreen(
        catalogoMateriales: _materiales,
        tecnicosLista: _tecnicosLista,
      ),

      // 3. Mis Requisiciones a Bodega
      MisRequisicionesScreen(
        catalogoMateriales: _materiales,
        placaVehiculo: _placaVehiculo,
        tecnicoNombre: _tecnicoNombre,
      ),

      // 4. Perfil / Pánico
      PerfilTecnicoScreen(
        tecnicoNombre: _tecnicoNombre,
        areaTrabajo: _areaTrabajo,
        fotoPerfil: _fotoPerfil,
        estadoActividad: _estadoActividad,
        onLogout: _handleLogout,
      ),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: pages,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08), width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
          backgroundColor: const Color(0xFF1E293B),
          selectedItemColor: const Color(0xFF38BDF8),
          unselectedItemColor: const Color(0xFF94A3B8),
          selectedLabelStyle: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold),
          unselectedLabelStyle: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600),
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.calendar_month_rounded),
              activeIcon: Icon(Icons.calendar_month_rounded, color: Color(0xFF38BDF8)),
              label: 'Agenda',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.directions_car_filled_rounded),
              activeIcon: Icon(Icons.directions_car_filled_rounded, color: Color(0xFF38BDF8)),
              label: 'Vehículo',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.inventory_rounded),
              activeIcon: Icon(Icons.inventory_rounded, color: Color(0xFF38BDF8)),
              label: 'Bodega',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_rounded),
              activeIcon: Icon(Icons.person_rounded, color: Color(0xFF38BDF8)),
              label: 'Perfil',
            ),
          ],
        ),
      ),
    );
  }
}
