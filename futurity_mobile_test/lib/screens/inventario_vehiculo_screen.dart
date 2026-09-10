import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/inventario_model.dart';
import '../services/api_service.dart';

class InventarioVehiculoScreen extends StatefulWidget {
  final List<dynamic> catalogoMateriales;
  final List<dynamic> tecnicosLista;

  const InventarioVehiculoScreen({
    super.key,
    this.catalogoMateriales = const [],
    this.tecnicosLista = const [],
  });

  @override
  State<InventarioVehiculoScreen> createState() => _InventarioVehiculoScreenState();
}

class _InventarioVehiculoScreenState extends State<InventarioVehiculoScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  String _tecnicoNombre = '';
  String _placaVehiculo = 'S/P';
  List<MaterialVehiculo> _materiales = [];
  List<EquipoRetirado> _equiposRetirados = [];
  final Set<int> _selectedIdsRetiro = {};
  bool _isProcessing = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadInventario();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadInventario() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await ApiService.getMiInventario();
    if (!mounted) return;

    if (res['success'] == true) {
      setState(() {
        _tecnicoNombre = res['tecnico'] ?? '';
        _placaVehiculo = res['placa'] ?? 'S/P';
        _materiales = (res['materiales'] as List<MaterialVehiculo>?) ?? [];
        _equiposRetirados = (res['equipos_retirados'] as List<EquipoRetirado>?) ?? [];
        _selectedIdsRetiro.clear();
        _isLoading = false;
      });
    } else {
      setState(() {
        _errorMessage = res['message'] ?? 'Error al cargar inventario';
        _isLoading = false;
      });
    }
  }

  Future<void> _handleDevolverEquipos() async {
    if (_selectedIdsRetiro.isEmpty) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: Text('Devolver a Bodega Central', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w800)),
        content: Text(
          '¿Confirmas la devolución física de ${_selectedIdsRetiro.length} equipo(s) retirado(s) a Bodega Central?',
          style: GoogleFonts.inter(color: const Color(0xFFCBD5E1)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8)),
            child: const Text('Confirmar Devolución', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isProcessing = true);
    final res = await ApiService.devolverEquiposBodega(_selectedIdsRetiro.toList());
    if (!mounted) return;
    setState(() => _isProcessing = false);

    if (res['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res['message'] ?? 'Equipos devueltos a Bodega Central exitosamente.'), backgroundColor: const Color(0xFF10B981)),
      );
      _loadInventario();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res['message'] ?? 'Error al devolver equipos'), backgroundColor: const Color(0xFFF87171)),
      );
    }
  }

  void _showTraspasoModal() {
    String? tecnicoDestino;
    int? materialId;
    int cantidad = 1;

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
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Traspaso de Material a Técnico', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                      IconButton(icon: const Icon(Icons.close_rounded, color: Colors.white70), onPressed: () => Navigator.pop(context)),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Selector Técnico Destino
                  Text('Técnico Destino:', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF94A3B8))),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white10)),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        dropdownColor: const Color(0xFF0F172A),
                        value: tecnicoDestino,
                        hint: Text('Seleccionar técnico...', style: GoogleFonts.inter(color: Colors.white38, fontSize: 13)),
                        isExpanded: true,
                        items: widget.tecnicosLista.map<DropdownMenuItem<String>>((t) {
                          final nombre = t['nombre'] ?? t.toString();
                          final placa = t['placa'] ?? 'S/P';
                          return DropdownMenuItem<String>(
                            value: nombre,
                            child: Text('$nombre ($placa)', style: GoogleFonts.inter(color: Colors.white, fontSize: 13)),
                          );
                        }).toList(),
                        onChanged: (val) => setModalState(() => tecnicoDestino = val),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Selector Material
                  Text('Material a Transferir:', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF94A3B8))),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white10)),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<int>(
                        dropdownColor: const Color(0xFF0F172A),
                        value: materialId,
                        hint: Text('Seleccionar material de mi inventario...', style: GoogleFonts.inter(color: Colors.white38, fontSize: 13)),
                        isExpanded: true,
                        items: _materiales.map<DropdownMenuItem<int>>((m) {
                          return DropdownMenuItem<int>(
                            value: m.idMaterial,
                            child: Text('${m.nombreMaterial} (Stock: ${m.cantidadActual} ${m.unidadMedida})', style: GoogleFonts.inter(color: Colors.white, fontSize: 13)),
                          );
                        }).toList(),
                        onChanged: (val) => setModalState(() => materialId = val),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Cantidad
                  Text('Cantidad:', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF94A3B8))),
                  const SizedBox(height: 6),
                  TextFormField(
                    initialValue: '1',
                    keyboardType: TextInputType.number,
                    style: GoogleFonts.inter(color: Colors.white),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: const Color(0xFF0F172A),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.white10)),
                    ),
                    onChanged: (val) => cantidad = int.tryParse(val) ?? 1,
                  ),
                  const SizedBox(height: 20),

                  // Botón Enviar Traspaso
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF38BDF8),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(Icons.swap_horiz_rounded, color: Colors.black),
                      label: Text('Registrar Traspaso', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.black)),
                      onPressed: () async {
                        if (tecnicoDestino == null || materialId == null || cantidad <= 0) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Por favor completa todos los campos del traspaso')));
                          return;
                        }

                        Navigator.pop(context);
                        setState(() => _isProcessing = true);
                        final res = await ApiService.traspasoMaterial(
                          tecnicoDestino: tecnicoDestino!,
                          idMaterial: materialId!,
                          cantidad: cantidad,
                        );
                        if (!mounted) return;
                        setState(() => _isProcessing = false);

                        if (res['success'] == true) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? 'Traspaso realizado con éxito'), backgroundColor: const Color(0xFF10B981)));
                          _loadInventario();
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? 'Error en traspaso'), backgroundColor: const Color(0xFFF87171)));
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Row(
          children: [
            const Icon(Icons.directions_car_filled_rounded, color: Color(0xFF38BDF8), size: 22),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Mi Vehículo', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                Text('Placa: $_placaVehiculo', style: GoogleFonts.robotoMono(fontSize: 11.5, color: const Color(0xFF38BDF8), fontWeight: FontWeight.bold)),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.swap_horiz_rounded, color: Color(0xFF38BDF8)),
            tooltip: 'Traspaso de Material',
            onPressed: _showTraspasoModal,
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
            onPressed: _loadInventario,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF38BDF8),
          indicatorWeight: 3,
          labelColor: const Color(0xFF38BDF8),
          unselectedLabelColor: const Color(0xFF94A3B8),
          labelStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w800),
          tabs: [
            Tab(text: 'Materiales (${_materiales.length})'),
            Tab(text: 'Equipos Retirados (${_equiposRetirados.length})'),
          ],
        ),
      ),
      body: _isLoading || _isProcessing
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline_rounded, color: Color(0xFFF87171), size: 48),
                      const SizedBox(height: 12),
                      Text(_errorMessage!, style: GoogleFonts.inter(color: Colors.white70)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadInventario,
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8)),
                        child: const Text('Reintentar', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    // Tab 1: Materiales asignados
                    _buildMaterialesTab(),

                    // Tab 2: Equipos Retirados en custodia
                    _buildEquiposRetiradosTab(),
                  ],
                ),
    );
  }

  Widget _buildMaterialesTab() {
    if (_materiales.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.inventory_2_outlined, size: 54, color: Color(0xFF64748B)),
            const SizedBox(height: 12),
            Text('Sin materiales asignados', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
            Text('Tu vehículo no registra stock de insumos actualmente.', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8))),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _materiales.length,
      itemBuilder: (context, index) {
        final m = _materiales[index];
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFF38BDF8).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.category_rounded, color: Color(0xFF38BDF8), size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(m.nombreMaterial, style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                    Text('Unidad: ${m.unidadMedida}', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8))),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white10)),
                child: Text(
                  '${m.cantidadActual}',
                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w900, color: const Color(0xFF38BDF8)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEquiposRetiradosTab() {
    if (_equiposRetirados.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_outline_rounded, size: 54, color: Color(0xFF34D399)),
            const SizedBox(height: 12),
            Text('Sin equipos en custodia', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
            Text('No tienes equipos pendientes por entregar a Bodega.', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8))),
          ],
        ),
      );
    }

    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _equiposRetirados.length,
            itemBuilder: (context, index) {
              final eq = _equiposRetirados[index];
              final isSelected = _selectedIdsRetiro.contains(eq.idRetiro);

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF38BDF8).withValues(alpha: 0.12) : const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: isSelected ? const Color(0xFF38BDF8) : Colors.white.withValues(alpha: 0.06), width: isSelected ? 1.5 : 1),
                ),
                child: CheckboxListTile(
                  value: isSelected,
                  activeColor: const Color(0xFF38BDF8),
                  checkColor: Colors.black,
                  title: Text('${eq.tipoEquipo} - ${eq.serialNumber}', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 4),
                      Text('Cliente: ${eq.clienteNombre}', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFFCBD5E1))),
                      Text('Retirado: ${eq.fechaRetiro}', style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8))),
                    ],
                  ),
                  onChanged: (val) {
                    setState(() {
                      if (val == true) {
                        _selectedIdsRetiro.add(eq.idRetiro);
                      } else {
                        _selectedIdsRetiro.remove(eq.idRetiro);
                      }
                    });
                  },
                ),
              );
            },
          ),
        ),
        if (_selectedIdsRetiro.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            color: const Color(0xFF1E293B),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF38BDF8),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.unarchive_rounded, color: Colors.black),
                label: Text(
                  'Devolver ${_selectedIdsRetiro.length} Equipo(s) a Bodega',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.black, fontSize: 15),
                ),
                onPressed: _handleDevolverEquipos,
              ),
            ),
          ),
      ],
    );
  }
}
