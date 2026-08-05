import React, { useState, useEffect } from 'react';

function UsuariosTab({ token, user }) {
  const userRole = user?.rol || 'ASESOR';
  const isAdmin = userRole === 'ADMIN';

  // Sub-tabs: 'usuarios', 'tecnicos', 'recordatorios'
  const [subTab, setSubTab] = useState(isAdmin ? 'usuarios' : 'recordatorios');

  // Lists Data
  const [usuarios, setUsuarios] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [recordatorios, setRecordatorios] = useState([]);

  // Search Filters
  const [searchUser, setSearchUser] = useState('');
  const [searchTecnico, setSearchTecnico] = useState('');
  const [searchRecordatorio, setSearchRecordatorio] = useState('');

  // UI Loaders
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = create, obj = edit
  const [userForm, setUserForm] = useState({ nombre: '', email: '', password: '', rol: 'ASESOR', activo: 1, area_trabajo: 'SOPORTE' });

  const [showPassModal, setShowPassModal] = useState(false);
  const [passUser, setPassUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const [showTecnicoModal, setShowTecnicoModal] = useState(false);
  const [editingTecnico, setEditingTecnico] = useState(null);
  const [tecnicoForm, setTecnicoForm] = useState({ nombre: '', placa_vehiculo: '', area_trabajo: 'SOPORTE', activo: 1 });

  const [showRecordatorioModal, setShowRecordatorioModal] = useState(false);
  const [recForm, setRecForm] = useState({ titulo: '', descripcion: '', tipo: 'BLOQUEO DE HORARIO', fecha: new Date().toISOString().split('T')[0], hora_inicio: '', hora_fin: '', tecnico_id: '' });

  // Initial Fetch
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        // Fetch Users
        const uRes = await fetch('/api/admin/usuarios', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const uData = await uRes.json();
        if (uData.status === 'ok') setUsuarios(uData.usuarios || []);
      }

      // Fetch Technicians
      const tRes = await fetch('/api/admin/tecnicos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const tData = await tRes.json();
      if (tData.status === 'ok') setTecnicos(tData.tecnicos || []);

      // Fetch Recordatorios
      const rRes = await fetch('/api/admin/recordatorios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const rData = await rRes.json();
      if (rData.status === 'ok') setRecordatorios(rData.recordatorios || []);
    } catch (e) {
      console.error("Error al cargar datos de gestión:", e);
    } finally {
      setLoading(false);
    }
  };

  // --- USER ACTIONS ---
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserForm({ nombre: '', email: '', password: '', rol: 'ASESOR', activo: 1, area_trabajo: 'SOPORTE' });
    setShowUserModal(true);
  };

  const handleOpenEditUser = (u) => {
    setEditingUser(u);
    setUserForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, activo: u.activo ? 1 : 0, area_trabajo: u.area_trabajo || 'SOPORTE' });
    setShowUserModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    const endpoint = editingUser ? `/api/admin/usuarios/${editingUser.id_usuario}` : '/api/admin/usuarios';
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(userForm)
      });
      const data = await res.json();
      if (data.status === 'ok') {
        alert(data.message);
        setShowUserModal(false);
        loadAllData();
      } else {
        alert("Error: " + data.message);
      }
    } catch (err) {
      alert("Error al conectar con el servidor.");
    }
  };

  const handleToggleUser = async (id) => {
    try {
      const res = await fetch(`/api/admin/usuarios/${id}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'ok') {
        loadAllData();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Error en la solicitud.");
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) return;

    try {
      const res = await fetch(`/api/admin/usuarios/${passUser.id_usuario}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        alert("Contraseña cambiada exitosamente.");
        setShowPassModal(false);
        setNewPassword('');
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Error al actualizar la contraseña.");
    }
  };

  // --- TECNICO ACTIONS ---
  const handleOpenCreateTecnico = () => {
    setEditingTecnico(null);
    setTecnicoForm({ nombre: '', placa_vehiculo: '', area_trabajo: 'SOPORTE', activo: 1 });
    setShowTecnicoModal(true);
  };

  const handleSaveTecnico = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('nombre', tecnicoForm.nombre);
    formData.append('placa_vehiculo', tecnicoForm.placa_vehiculo);
    formData.append('area_trabajo', tecnicoForm.area_trabajo);
    formData.append('activo', tecnicoForm.activo);

    const endpoint = editingTecnico ? `/api/admin/tecnicos/${editingTecnico.id_tecnico}` : '/api/admin/tecnicos';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.status === 'ok') {
        alert(data.message);
        setShowTecnicoModal(false);
        loadAllData();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Error al procesar técnico.");
    }
  };

  const handleToggleTecnico = async (id) => {
    try {
      const res = await fetch(`/api/admin/tecnicos/${id}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'ok') {
        loadAllData();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Error de conexión.");
    }
  };

  // --- RECORDATORIOS ACTIONS ---
  const handleSaveRecordatorio = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/recordatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(recForm)
      });
      const data = await res.json();
      if (data.status === 'ok') {
        alert("Recordatorio/Bloqueo creado con éxito.");
        setShowRecordatorioModal(false);
        setRecForm({ titulo: '', descripcion: '', tipo: 'BLOQUEO DE HORARIO', fecha: new Date().toISOString().split('T')[0], hora_inicio: '', hora_fin: '', tecnico_id: '' });
        loadAllData();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Error al guardar recordatorio.");
    }
  };

  const handleDeleteRecordatorio = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar/atender este recordatorio o bloqueo?")) return;
    try {
      const res = await fetch(`/api/admin/recordatorios/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'ok') {
        loadAllData();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Error al eliminar.");
    }
  };

  // Filtered lists
  const filteredUsuarios = usuarios.filter(u =>
    u.nombre?.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchUser.toLowerCase())
  );

  const filteredTecnicos = tecnicos.filter(t =>
    t.nombre?.toLowerCase().includes(searchTecnico.toLowerCase()) ||
    t.placa_vehiculo?.toLowerCase().includes(searchTecnico.toLowerCase())
  );

  const filteredRecordatorios = recordatorios.filter(r =>
    r.titulo?.toLowerCase().includes(searchRecordatorio.toLowerCase()) ||
    r.tecnico_nombre?.toLowerCase().includes(searchRecordatorio.toLowerCase()) ||
    r.tipo?.toLowerCase().includes(searchRecordatorio.toLowerCase())
  );

  // Role Badge Helper
  const renderRoleBadge = (rol) => {
    const roleStyles = {
      ADMIN: { bg: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', label: '👑 ADMIN' },
      ASESOR: { bg: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', label: '🎧 ASESOR' },
      TECNICO: { bg: 'rgba(16, 185, 129, 0.12)', color: '#059669', label: '🛠️ TÉCNICO' },
      BODEGA: { bg: 'rgba(245, 158, 11, 0.12)', color: '#d97706', label: '📦 BODEGA' },
      CALIDAD: { bg: 'rgba(6, 182, 212, 0.12)', color: '#0891b2', label: '✨ CALIDAD' },
    };
    const s = roleStyles[rol] || { bg: '#f1f5f9', color: '#475569', label: rol };
    return (
      <span style={{ background: s.bg, color: s.color, padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem' }}>
        {s.label}
      </span>
    );
  };

  return (
    <div id="tab-usuarios" className="tab-content active" style={{ display: 'block', padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
      
      {/* Hero Header */}
      <div style={{ background: 'var(--card-bg)', padding: '24px 30px', borderRadius: '20px', marginBottom: '25px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-main)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {isAdmin ? 'Gestión del Personal y Accesos' : 'Recordatorios y Bloqueos de Agenda'}
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--sidebar-text)', fontSize: '0.9rem', fontWeight: 500 }}>
            {isAdmin
              ? 'Administración centralizada de cuentas de usuarios, permisos, roles y catálogo de técnicos.'
              : 'Gestión de bloqueos horarios, reuniones, inventarios y recordatorios para el equipo técnico.'}
          </p>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '25px', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setSubTab('usuarios')}
            style={{
              background: 'none', border: 'none', padding: '10px 18px', fontWeight: 800, fontSize: '0.95rem',
              color: subTab === 'usuarios' ? 'var(--primary)' : 'var(--sidebar-text)',
              borderBottom: subTab === 'usuarios' ? '3px solid var(--primary)' : 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <i className="fa-solid fa-users-gear"></i> Cuentas de Usuarios ({usuarios.length})
          </button>
        )}
        {(isAdmin || userRole === 'ASESOR' || userRole === 'CALIDAD') && (
          <button
            type="button"
            onClick={() => setSubTab('tecnicos')}
            style={{
              background: 'none', border: 'none', padding: '10px 18px', fontWeight: 800, fontSize: '0.95rem',
              color: subTab === 'tecnicos' ? 'var(--primary)' : 'var(--sidebar-text)',
              borderBottom: subTab === 'tecnicos' ? '3px solid var(--primary)' : 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <i className="fa-solid fa-helmet-safety"></i> Técnicos de Campo ({tecnicos.length})
          </button>
        )}
        <button
          type="button"
          onClick={() => setSubTab('recordatorios')}
          style={{
            background: 'none', border: 'none', padding: '10px 18px', fontWeight: 800, fontSize: '0.95rem',
            color: subTab === 'recordatorios' ? 'var(--primary)' : 'var(--sidebar-text)',
            borderBottom: subTab === 'recordatorios' ? '3px solid var(--primary)' : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <i className="fa-solid fa-clock"></i> Recordatorios y Bloqueos ({recordatorios.length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '15px' }}></i>
          <p style={{ margin: 0, color: 'var(--sidebar-text)', fontWeight: 600 }}>Cargando datos del personal...</p>
        </div>
      ) : (
        <>
          {/* ================= SECCIÓN 1: USUARIOS ================= */}
          {subTab === 'usuarios' && isAdmin && (
            <div>
              <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '16px 24px', border: '1px solid var(--border-color)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flexGrow: 1, maxWidth: '400px' }}>
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Buscar por nombre o correo..."
                    style={{ width: '100%', padding: '10px 15px 10px 38px', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.9rem', background: 'var(--card-bg)', color: 'var(--text-main)' }}
                  />
                  <i className="fa-solid fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sidebar-text)' }}></i>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCreateUser}
                  style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <i className="fa-solid fa-user-plus"></i> Crear Usuario
                </button>
              </div>

              <div style={{ background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', color: 'var(--sidebar-text)', fontWeight: 800 }}>
                        <th style={{ padding: '16px 20px' }}>ID</th>
                        <th style={{ padding: '16px 20px' }}>Nombre</th>
                        <th style={{ padding: '16px 20px' }}>Correo Electrónico</th>
                        <th style={{ padding: '16px 20px' }}>Rol</th>
                        <th style={{ padding: '16px 20px', textAlign: 'center' }}>Estado</th>
                        <th style={{ padding: '16px 20px', textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsuarios.map((u) => (
                        <tr key={u.id_usuario} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '16px 20px', fontWeight: 800 }}>#{u.id_usuario}</td>
                          <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--text-main)' }}>{u.nombre}</td>
                          <td style={{ padding: '16px 20px', color: 'var(--sidebar-text)' }}>{u.email}</td>
                          <td style={{ padding: '16px 20px' }}>{renderRoleBadge(u.rol)}</td>
                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <span style={{ padding: '4px 12px', borderRadius: '20px', fontWeight: 800, fontSize: '0.78rem', background: u.activo ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: u.activo ? '#10b981' : '#ef4444' }}>
                              {u.activo ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                title="Editar datos"
                                onClick={() => handleOpenEditUser(u)}
                                style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: 'var(--primary)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                              >
                                <i className="fa-solid fa-pen"></i>
                              </button>
                              <button
                                type="button"
                                title="Cambiar Contraseña"
                                onClick={() => { setPassUser(u); setNewPassword(''); setShowPassModal(true); }}
                                style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid #f59e0b', color: '#d97706', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                              >
                                <i className="fa-solid fa-key"></i>
                              </button>
                              <button
                                type="button"
                                title={u.activo ? 'Desactivar' : 'Activar'}
                                onClick={() => handleToggleUser(u.id_usuario)}
                                style={{ background: u.activo ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', border: 'none', color: u.activo ? '#ef4444' : '#10b981', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                              >
                                <i className={`fa-solid ${u.activo ? 'fa-user-slash' : 'fa-user-check'}`}></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= SECCIÓN 2: TÉCNICOS ================= */}
          {subTab === 'tecnicos' && (
            <div>
              <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '16px 24px', border: '1px solid var(--border-color)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flexGrow: 1, maxWidth: '400px' }}>
                  <input
                    type="text"
                    value={searchTecnico}
                    onChange={(e) => setSearchTecnico(e.target.value)}
                    placeholder="Buscar por nombre o placa..."
                    style={{ width: '100%', padding: '10px 15px 10px 38px', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.9rem', background: 'var(--card-bg)', color: 'var(--text-main)' }}
                  />
                  <i className="fa-solid fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sidebar-text)' }}></i>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleOpenCreateTecnico}
                    style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <i className="fa-solid fa-plus"></i> Registrar Técnico
                  </button>
                )}
              </div>

              <div style={{ background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', color: 'var(--sidebar-text)', fontWeight: 800 }}>
                        <th style={{ padding: '16px 20px' }}>Nombre</th>
                        <th style={{ padding: '16px 20px' }}>Placa Vehículo</th>
                        <th style={{ padding: '16px 20px', textAlign: 'center' }}>Área de Trabajo</th>
                        <th style={{ padding: '16px 20px', textAlign: 'center' }}>Estado</th>
                        {isAdmin && <th style={{ padding: '16px 20px', textAlign: 'center' }}>Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTecnicos.map((t) => (
                        <tr key={t.id_tecnico} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '16px 20px', fontWeight: 800, color: 'var(--text-main)' }}>
                            <i className="fa-solid fa-user-gear" style={{ marginRight: '8px', color: 'var(--primary)' }}></i>
                            {t.nombre}
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: 700, color: '#6366f1' }}>
                            🚘 {t.placa_vehiculo || 'S/P'}
                          </td>
                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem', background: t.area_trabajo === 'INSTALACIONES' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(2, 132, 199, 0.12)', color: t.area_trabajo === 'INSTALACIONES' ? '#4f46e5' : '#0284c7' }}>
                              {t.area_trabajo || 'SOPORTE'}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <span style={{ padding: '4px 12px', borderRadius: '20px', fontWeight: 800, fontSize: '0.78rem', background: t.activo ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: t.activo ? '#10b981' : '#ef4444' }}>
                              {t.activo ? 'DISPONIBLE' : 'INACTIVO'}
                            </span>
                          </td>
                          {isAdmin && (
                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                <button
                                  type="button"
                                  title="Editar Técnico"
                                  onClick={() => { setEditingTecnico(t); setTecnicoForm({ nombre: t.nombre, placa_vehiculo: t.placa_vehiculo || '', area_trabajo: t.area_trabajo || 'SOPORTE', activo: t.activo ? 1 : 0 }); setShowTecnicoModal(true); }}
                                  style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', color: 'var(--primary)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                                >
                                  <i className="fa-solid fa-pen"></i>
                                </button>
                                <button
                                  type="button"
                                  title={t.activo ? 'Desactivar' : 'Activar'}
                                  onClick={() => handleToggleTecnico(t.id_tecnico)}
                                  style={{ background: t.activo ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', border: 'none', color: t.activo ? '#ef4444' : '#10b981', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                                >
                                  <i className={`fa-solid ${t.activo ? 'fa-ban' : 'fa-check'}`}></i>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= SECCIÓN 3: RECORDATORIOS ================= */}
          {subTab === 'recordatorios' && (
            <div>
              <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '16px 24px', border: '1px solid var(--border-color)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flexGrow: 1, maxWidth: '400px' }}>
                  <input
                    type="text"
                    value={searchRecordatorio}
                    onChange={(e) => setSearchRecordatorio(e.target.value)}
                    placeholder="Buscar recordatorio o bloqueo..."
                    style={{ width: '100%', padding: '10px 15px 10px 38px', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.9rem', background: 'var(--card-bg)', color: 'var(--text-main)' }}
                  />
                  <i className="fa-solid fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sidebar-text)' }}></i>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecordatorioModal(true)}
                  style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <i className="fa-solid fa-plus"></i> Crear Recordatorio / Bloqueo
                </button>
              </div>

              <div style={{ background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--profile-bg)', borderBottom: '1px solid var(--border-color)', color: 'var(--sidebar-text)', fontWeight: 800 }}>
                        <th style={{ padding: '16px 20px' }}>Título y Descripción</th>
                        <th style={{ padding: '16px 20px' }}>Tipo</th>
                        <th style={{ padding: '16px 20px' }}>Fecha</th>
                        <th style={{ padding: '16px 20px' }}>Horario</th>
                        <th style={{ padding: '16px 20px' }}>Técnico Afectado</th>
                        <th style={{ padding: '16px 20px' }}>Creado Por</th>
                        <th style={{ padding: '16px 20px', textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecordatorios.map((r) => (
                        <tr key={r.id_recordatorio} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '16px 20px' }}>
                            <strong style={{ display: 'block', color: 'var(--text-main)' }}>{r.titulo}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-text)' }}>{r.descripcion || 'Sin descripción'}</span>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.75rem', background: r.tipo === 'BLOQUEO DE HORARIO' ? 'rgba(239, 68, 68, 0.12)' : r.tipo === 'REUNIÓN' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(245, 158, 11, 0.12)', color: r.tipo === 'BLOQUEO DE HORARIO' ? '#ef4444' : r.tipo === 'REUNIÓN' ? '#4f46e5' : '#d97706' }}>
                              {r.tipo}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: 700 }}>📅 {r.fecha}</td>
                          <td style={{ padding: '16px 20px', color: 'var(--sidebar-text)' }}>
                            {r.hora_inicio && r.hora_fin ? `⏰ ${r.hora_inicio} - ${r.hora_fin}` : 'Todo el día'}
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--text-main)' }}>
                            {r.tecnico_nombre ? `🛠️ ${r.tecnico_nombre}` : 'Todos los técnicos'}
                          </td>
                          <td style={{ padding: '16px 20px', color: 'var(--sidebar-text)' }}>{r.creado_por || 'Sistema'}</td>
                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <button
                              type="button"
                              title="Marcar como atendido / eliminar"
                              onClick={() => handleDeleteRecordatorio(r.id_recordatorio)}
                              style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem' }}
                            >
                              <i className="fa-solid fa-trash"></i> Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ================= MODAL DE CREAR / EDITAR USUARIO ================= */}
      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '480px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 850 }}>
              {editingUser ? '✏️ Editar Usuario' : '➕ Crear Nuevo Usuario'}
            </h3>
            <form onSubmit={handleSaveUser}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Nombre Completo:</label>
                <input
                  type="text"
                  required
                  value={userForm.nombre}
                  onChange={(e) => setUserForm({ ...userForm, nombre: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Correo Electrónico:</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                />
              </div>
              {!editingUser && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Contraseña:</label>
                  <input
                    type="password"
                    required
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                  />
                </div>
              )}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Rol:</label>
                <select
                  value={userForm.rol}
                  onChange={(e) => setUserForm({ ...userForm, rol: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                >
                  <option value="ASESOR">ASESOR</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="TECNICO">TECNICO</option>
                  <option value="BODEGA">BODEGA</option>
                  <option value="CALIDAD">CALIDAD</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px' }}>
                <button type="button" onClick={() => setShowUserModal(false)} style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CAMBIAR CONTRASEÑA ================= */}
      {showPassModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '420px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 850 }}>
              🔑 Cambiar Contraseña ({passUser?.nombre})
            </h3>
            <form onSubmit={handleSavePassword}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '6px' }}>Nueva Contraseña:</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Escribe la nueva contraseña..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowPassModal(false)} style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ background: '#d97706', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CREAR / EDITAR TÉCNICO ================= */}
      {showTecnicoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '440px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 850 }}>
              {editingTecnico ? '✏️ Editar Técnico' : '🦺 Registrar Nuevo Técnico'}
            </h3>
            <form onSubmit={handleSaveTecnico}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Nombre del Técnico:</label>
                <input
                  type="text"
                  required
                  value={tecnicoForm.nombre}
                  onChange={(e) => setTecnicoForm({ ...tecnicoForm, nombre: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Placa del Vehículo:</label>
                <input
                  type="text"
                  value={tecnicoForm.placa_vehiculo}
                  onChange={(e) => setTecnicoForm({ ...tecnicoForm, placa_vehiculo: e.target.value })}
                  placeholder="Ej. ABC-1234"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Área de Trabajo:</label>
                <select
                  value={tecnicoForm.area_trabajo}
                  onChange={(e) => setTecnicoForm({ ...tecnicoForm, area_trabajo: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                >
                  <option value="SOPORTE">SOPORTE</option>
                  <option value="INSTALACIONES">INSTALACIONES</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px' }}>
                <button type="button" onClick={() => setShowTecnicoModal(false)} style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CREAR RECORDATORIO / BLOQUEO ================= */}
      {showRecordatorioModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '480px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 850 }}>
              ⏰ Crear Recordatorio o Bloqueo de Horario
            </h3>
            <form onSubmit={handleSaveRecordatorio}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Título:</label>
                <input
                  type="text"
                  required
                  value={recForm.titulo}
                  onChange={(e) => setRecForm({ ...recForm, titulo: e.target.value })}
                  placeholder="Ej. Reunión de Equipo / Conteo Bodega"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Tipo de Bloqueo:</label>
                <select
                  value={recForm.tipo}
                  onChange={(e) => setRecForm({ ...recForm, tipo: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontWeight: 700 }}
                >
                  <option value="BLOQUEO DE HORARIO">BLOQUEO DE HORARIO</option>
                  <option value="REUNIÓN">REUNIÓN DE EQUIPO</option>
                  <option value="INVENTARIO">INVENTARIO / BODEGA</option>
                  <option value="RECORDATORIO INDIVIDUAL">RECORDATORIO INDIVIDUAL</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Fecha:</label>
                  <input
                    type="date"
                    required
                    value={recForm.fecha}
                    onChange={(e) => setRecForm({ ...recForm, fecha: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Desde:</label>
                  <input
                    type="time"
                    value={recForm.hora_inicio}
                    onChange={(e) => setRecForm({ ...recForm, hora_inicio: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Hasta:</label>
                  <input
                    type="time"
                    value={recForm.hora_fin}
                    onChange={(e) => setRecForm({ ...recForm, hora_fin: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Técnico Afectado (Opcional):</label>
                <select
                  value={recForm.tecnico_id}
                  onChange={(e) => setRecForm({ ...recForm, tecnico_id: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}
                >
                  <option value="">-- Todos los Técnicos --</option>
                  {tecnicos.map((t) => (
                    <option key={t.id_tecnico} value={t.id_tecnico}>{t.nombre}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--sidebar-text)', marginBottom: '4px' }}>Descripción / Nota:</label>
                <textarea
                  rows="2"
                  value={recForm.descripcion}
                  onChange={(e) => setRecForm({ ...recForm, descripcion: e.target.value })}
                  placeholder="Detalles sobre el bloqueo..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowRecordatorioModal(false)} style={{ background: 'var(--profile-bg)', border: '1px solid var(--border-color)', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>
                  Crear Bloqueo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsuariosTab;
