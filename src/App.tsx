import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";

type Role = "admin" | "tech" | "user";
type Priority = "Baja" | "Media" | "Alta" | "Crítica";
type Status = "Abierto" | "En progreso" | "Resuelto" | "Cerrado";

interface User { id: number; name: string; role: Role; avatar: string; email: string; }
interface Ticket { id: number; title: string; description: string; category: string; priority: Priority; status: Status; created_by: number; assigned_to: number | null; created_at: string; }
interface HistoryEntry { id: number; ticket_id: number; user_name: string; action: string; created_at: string; }

const ROLES: Record<Role, string> = { admin: "Administrador", tech: "Técnico", user: "Empleado" };
const CATEGORIES = ["Hardware", "Software", "Red / Conectividad", "Accesos y Permisos", "Impresoras", "Otro"];
const PRIORITIES: Priority[] = ["Baja", "Media", "Alta", "Crítica"];
const STATUSES: Status[] = ["Abierto", "En progreso", "Resuelto", "Cerrado"];
const priorityColor: Record<Priority, string> = { Baja: "#1D9E75", Media: "#BA7517", Alta: "#D85A30", Crítica: "#A32D2D" };
const statusColor: Record<Status, string> = { Abierto: "#378ADD", "En progreso": "#BA7517", Resuelto: "#1D9E75", Cerrado: "#888780" };
const statusBg: Record<Status, string> = { Abierto: "#E6F1FB", "En progreso": "#FAEEDA", Resuelto: "#E1F5EE", Cerrado: "#F1EFE8" };
const statusText: Record<Status, string> = { Abierto: "#0C447C", "En progreso": "#633806", Resuelto: "#085041", Cerrado: "#444441" };
const priorityBg: Record<Priority, string> = { Baja: "#E1F5EE", Media: "#FAEEDA", Alta: "#FAECE7", Crítica: "#FCEBEB" };

const Avatar = ({ initials, size = 32 }: { initials: string; size?: number }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, fontSize: size * 0.35, color: "#185FA5", flexShrink: 0 }}>{initials}</div>
);
const Badge = ({ label, bg, color }: { label: string; bg: string; color: string }) => (
  <span style={{ background: bg, color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>{label}</span>
);
const StatusBadge = ({ status }: { status: Status }) => <Badge label={status} bg={statusBg[status]} color={statusText[status]} />;
const PriorityBadge = ({ priority }: { priority: Priority }) => <Badge label={priority} bg={priorityBg[priority]} color={priorityColor[priority]} />;

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) { setError("No se pudo enviar el link. Verificá el email."); }
    else { setSent(true); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7fa" }}>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #eee", padding: 40, width: 360, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🎫</div>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px" }}>Mesa de Ayuda</h1>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 24px" }}>La Defe</p>
        {!sent ? (
          <>
            <p style={{ fontSize: 14, color: "#555", margin: "0 0 16px" }}>Ingresá tu email institucional para recibir un link de acceso.</p>
            <input type="email" placeholder="tu@ladefe.gob.ar" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ width: "100%", marginBottom: 12, padding: 10, borderRadius: 6, border: "1px solid #ddd", fontSize: 14, boxSizing: "border-box" }} />
            {error && <p style={{ color: "#A32D2D", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
            <button onClick={handleLogin} disabled={loading}
              style={{ width: "100%", background: "#185FA5", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
              {loading ? "Enviando..." : "Enviar link de acceso"}
            </button>
          </>
        ) : (
          <div style={{ background: "#E1F5EE", borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📧</div>
            <p style={{ fontSize: 14, color: "#085041", margin: 0 }}>Revisá tu email <strong>{email}</strong>. Te enviamos un link para ingresar.</p>
            <button onClick={() => setSent(false)} style={{ marginTop: 16, background: "transparent", border: "none", color: "#185FA5", cursor: "pointer", fontSize: 13 }}>Usar otro email</button>
          </div>
        )}
      </div>
    </div>
  );
}
function UsuariosPanel({ users, onRefresh }: { users: User[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "user" as Role, avatar: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const openNew = () => { setForm({ name: "", email: "", role: "user", avatar: "" }); setEditUser(null); setError(""); setShowForm(true); };
  const openEdit = (u: User) => { setForm({ name: u.name, email: u.email, role: u.role, avatar: u.avatar }); setEditUser(u); setError(""); setShowForm(true); };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError("Nombre y email son obligatorios."); return; }
    setLoading(true);
    const avatar = form.avatar.trim() || getInitials(form.name);
    if (editUser) {
      await supabase.from("users").update({ name: form.name, email: form.email, role: form.role, avatar }).eq("id", editUser.id);
    } else {
      await supabase.from("users").insert([{ name: form.name, email: form.email, role: form.role, avatar }]);
    }
    setShowForm(false);
    setLoading(false);
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Seguro que querés eliminar este usuario?")) return;
    await supabase.from("users").delete().eq("id", id);
    onRefresh();
  };

  const roleLabel: Record<Role, string> = { admin: "Administrador", tech: "Técnico", user: "Empleado" };
  const roleBg: Record<Role, string> = { admin: "#E6F1FB", tech: "#E1F5EE", user: "#F1EFE8" };
  const roleColor: Record<Role, string> = { admin: "#0C447C", tech: "#085041", user: "#444441" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Usuarios</h2>
        <button onClick={openNew} style={{ background: "#185FA5", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>+ Nuevo usuario</button>
      </div>

      {showForm && (
        <div style={{ background: "#f8f8f8", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{editUser ? "Editar usuario" : "Nuevo usuario"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "#888" }}>Nombre completo *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value, avatar: getInitials(e.target.value) })}
                placeholder="Ej: Juan Pérez" style={{ display: "block", width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 14, boxSizing: "border-box" as const }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#888" }}>Email institucional *</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="juan.perez@ladefe.gob.ar" style={{ display: "block", width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 14, boxSizing: "border-box" as const }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#888" }}>Rol</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}
              style={{ display: "block", marginTop: 4, fontSize: 13, padding: "6px 8px", borderRadius: 4, border: "1px solid #ddd", width: 200 }}>
              <option value="user">Empleado</option>
              <option value="tech">Técnico de Soporte</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          {error && <p style={{ color: "#A32D2D", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={loading} style={{ background: "#185FA5", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontSize: 13 }}>
              {loading ? "Guardando..." : "Guardar"}
            </button>
            <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: "1px solid #ccc", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f8f8f8", borderBottom: "1px solid #eee" }}>
              <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 500, fontSize: 13, color: "#888" }}>Usuario</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 500, fontSize: 13, color: "#888" }}>Email</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 500, fontSize: 13, color: "#888" }}>Rol</th>
              <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 500, fontSize: 13, color: "#888" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                <td style={{ padding: "10px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar initials={u.avatar} size={32} />
                    <span style={{ fontWeight: 500 }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: "10px 16px", color: "#555", fontSize: 13 }}>{u.email}</td>
                <td style={{ padding: "10px 16px" }}>
                  <span style={{ background: roleBg[u.role], color: roleColor[u.role], fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 4 }}>{roleLabel[u.role]}</span>
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                  <button onClick={() => openEdit(u)} style={{ background: "transparent", border: "1px solid #ddd", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 12, marginRight: 6 }}>Editar</button>
                  <button onClick={() => handleDelete(u.id)} style={{ background: "transparent", border: "1px solid #f5c1c1", color: "#A32D2D", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState("dashboard");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterPriority, setFilterPriority] = useState("Todos");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: "", desc: "", category: CATEGORIES[0], priority: "Media" as Priority });
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);

  useEffect(() => { if (session) loadAll(); else setLoading(false); }, [session]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: u }, { data: t }, { data: h }] = await Promise.all([
      supabase.from("users").select("*").order("id"),
      supabase.from("tickets").select("*").order("id", { ascending: false }),
      supabase.from("ticket_history").select("*").order("created_at"),
    ]);
    const allUsers = (u as User[]) || [];
    setUsers(allUsers);
    setTickets((t as Ticket[]) || []);
    setHistory((h as HistoryEntry[]) || []);
    if (session?.user?.email) {
      const matched = allUsers.find(u => u.email === session.user.email);
      setCurrentUser(matched || null);
    }
    setLoading(false);
  };

  const visibleTickets = useMemo(() => {
    if (!currentUser) return [];
    let t = tickets;
    if (currentUser.role === "user") t = t.filter(x => x.created_by === currentUser.id);
    if (currentUser.role === "tech") t = t.filter(x => x.assigned_to === currentUser.id || x.assigned_to === null);
    if (filterStatus !== "Todos") t = t.filter(x => x.status === filterStatus);
    if (filterPriority !== "Todos") t = t.filter(x => x.priority === filterPriority);
    return t;
  }, [tickets, currentUser, filterStatus, filterPriority]);

  const stats = useMemo(() => {
    if (!currentUser) return { total: 0, abiertos: 0, enProgreso: 0, resueltos: 0 };
    const base = currentUser.role === "user" ? tickets.filter(x => x.created_by === currentUser.id) : tickets;
    return { total: base.length, abiertos: base.filter(x => x.status === "Abierto").length, enProgreso: base.filter(x => x.status === "En progreso").length, resueltos: base.filter(x => x.status === "Resuelto" || x.status === "Cerrado").length };
  }, [tickets, currentUser]);

  const ticketHistory = (id: number) => history.filter(h => h.ticket_id === id);

  const handleCreateTicket = async () => {
    if (!newTicket.title.trim() || !currentUser) return;
    const now = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("tickets").insert([{ title: newTicket.title, description: newTicket.desc, category: newTicket.category, priority: newTicket.priority, status: "Abierto", created_by: currentUser.id, assigned_to: null, created_at: now }]).select().single();
    if (data) {
      await supabase.from("ticket_history").insert([{ ticket_id: data.id, user_name: currentUser.name, action: "Ticket creado" }]);
      setNewTicket({ title: "", desc: "", category: CATEGORIES[0], priority: "Media" });
      setShowNewForm(false);
      await loadAll();
    }
  };

  const updateTicket = async (id: number, changes: Partial<Ticket>, action: string) => {
    if (!currentUser) return;
    await supabase.from("tickets").update(changes).eq("id", id);
    await supabase.from("ticket_history").insert([{ ticket_id: id, user_name: currentUser.name, action }]);
    await loadAll();
  };

  const addComment = async (id: number) => {
    if (!comment.trim() || !currentUser) return;
    await supabase.from("ticket_history").insert([{ ticket_id: id, user_name: currentUser.name, action: `Comentario: "${comment}"` }]);
    setComment("");
    await loadAll();
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setCurrentUser(null); setView("dashboard"); };

  if (!session) return <LoginScreen />;
  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando...</div>;
  if (!currentUser) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7fa" }}>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #eee", padding: 40, textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 8px" }}>Email no registrado</h2>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 20px" }}>Tu email no tiene acceso al sistema. Contactá al administrador.</p>
        <button onClick={handleLogout} style={{ background: "#185FA5", color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", cursor: "pointer", fontSize: 13 }}>Cerrar sesión</button>
      </div>
    </div>
  );

  const sel = selectedTicket ? tickets.find(t => t.id === selectedTicket.id) : null;
  const navStyle = (v: string) => ({ padding: "8px 14px", background: view === v ? "#E6F1FB" : "transparent", color: view === v ? "#0C447C" : "#555", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: view === v ? 500 : 400, fontSize: 14, display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left" as const });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#222", minHeight: "100vh" }}>
      <div style={{ background: "#185FA5", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
        <span style={{ color: "#fff", fontWeight: 500, fontSize: 16 }}>🎫 Mesa de Ayuda</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#B5D4F4", fontSize: 13 }}>{currentUser.name}</span>
          <button onClick={handleLogout} style={{ background: "transparent", border: "1px solid #378ADD", color: "#fff", borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontSize: 12 }}>Salir</button>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 52px)" }}>
        <div style={{ width: 190, borderRight: "1px solid #eee", padding: "16px 10px", display: "flex", flexDirection: "column", gap: 4, background: "#fafafa" }}>
          <button style={navStyle("dashboard")} onClick={() => { setView("dashboard"); setSelectedTicket(null); }}>📊 Dashboard</button>
          <button style={navStyle("tickets")} onClick={() => { setView("tickets"); setSelectedTicket(null); }}>🎫 Tickets</button>
          {currentUser.role === "admin" && <button style={navStyle("reportes")} onClick={() => { setView("reportes"); setSelectedTicket(null); }}>📈 Reportes</button>}
          {currentUser.role === "admin" && <button style={navStyle("usuarios")} onClick={() => { setView("usuarios"); setSelectedTicket(null); }}>👥 Usuarios</button>}
          <div style={{ marginTop: "auto", padding: "10px 6px", borderTop: "1px solid #eee" }}>
            <Avatar initials={currentUser.avatar} size={28} />
            <div style={{ fontSize: 12, marginTop: 6, color: "#666" }}>{currentUser.name}</div>
            <div style={{ fontSize: 11, color: "#378ADD" }}>{ROLES[currentUser.role]}</div>
          </div>
        </div>

        <div style={{ flex: 1, padding: 20, overflowY: "auto", background: "#fff" }}>
          {view === "dashboard" && !selectedTicket && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 16px" }}>Dashboard</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                {([["Total tickets", stats.total, "#E6F1FB", "#0C447C"], ["Abiertos", stats.abiertos, "#FAEEDA", "#633806"], ["En progreso", stats.enProgreso, "#E1F5EE", "#085041"], ["Resueltos/Cerrados", stats.resueltos, "#F1EFE8", "#444441"]] as [string, number, string, string][]).map(([label, val, bg, col]) => (
                  <div key={label} style={{ background: bg, borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, color: col, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 28, fontWeight: 500, color: col }}>{val}</div>
                  </div>
                ))}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 10px" }}>Tickets recientes</h3>
              {tickets.slice(0, 5).map(t => {
                const creator = users.find(u => u.id === t.created_by);
                return (
                  <div key={t.id} onClick={() => { setSelectedTicket(t); setView("tickets"); }} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: "10px 14px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar initials={creator?.avatar || ""} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>{t.category} · {t.created_at}</div>
                    </div>
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                  </div>
                );
              })}
            </div>
          )}

          {view === "tickets" && !selectedTicket && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Tickets</h2>
                {(currentUser.role === "user" || currentUser.role === "admin") && (
                  <button onClick={() => setShowNewForm(true)} style={{ background: "#185FA5", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>+ Nuevo ticket</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd" }}>
                  <option>Todos</option>{STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd" }}>
                  <option>Todos</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              {showNewForm && (
                <div style={{ background: "#f8f8f8", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 14 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Nuevo ticket</h3>
                  <input placeholder="Título del problema *" value={newTicket.title} onChange={e => setNewTicket({ ...newTicket, title: e.target.value })} style={{ width: "100%", marginBottom: 8, padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 14, boxSizing: "border-box" }} />
                  <textarea placeholder="Descripción detallada" value={newTicket.desc} onChange={e => setNewTicket({ ...newTicket, desc: e.target.value })} style={{ width: "100%", height: 60, marginBottom: 8, resize: "vertical", padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 14, fontFamily: "system-ui", boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <select value={newTicket.category} onChange={e => setNewTicket({ ...newTicket, category: e.target.value })} style={{ flex: 1, fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd" }}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                    <select value={newTicket.priority} onChange={e => setNewTicket({ ...newTicket, priority: e.target.value as Priority })} style={{ flex: 1, fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd" }}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleCreateTicket} style={{ background: "#185FA5", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontSize: 13 }}>Crear ticket</button>
                    <button onClick={() => setShowNewForm(false)} style={{ background: "transparent", border: "1px solid #ccc", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                  </div>
                </div>
              )}
              {visibleTickets.length === 0 && <div style={{ color: "#888", fontSize: 14, padding: 20, textAlign: "center" }}>No hay tickets para mostrar.</div>}
              {visibleTickets.map(t => {
                const creator = users.find(u => u.id === t.created_by);
                const assignee = users.find(u => u.id === t.assigned_to);
                return (
                  <div key={t.id} onClick={() => setSelectedTicket(t)} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: "12px 16px", marginBottom: 8, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <Avatar initials={creator?.avatar || ""} size={32} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 500, fontSize: 14 }}>#{t.id} {t.title}</span>
                          <StatusBadge status={t.status} /><PriorityBadge priority={t.priority} />
                        </div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>
                          {t.category} · Creado por {creator?.name} · {t.created_at}
                          {assignee && <span> · Asignado a <strong>{assignee.name}</strong></span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === "tickets" && sel && (
            <div>
              <button onClick={() => setSelectedTicket(null)} style={{ background: "transparent", border: "none", color: "#378ADD", cursor: "pointer", fontSize: 13, marginBottom: 14, padding: 0 }}>← Volver a tickets</button>
              <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 20, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>#{sel.id} {sel.title}</h2>
                  <div style={{ display: "flex", gap: 6 }}><StatusBadge status={sel.status} /><PriorityBadge priority={sel.priority} /></div>
                </div>
                <p style={{ fontSize: 14, color: "#666", margin: "0 0 14px" }}>{sel.description}</p>
                <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#888", flexWrap: "wrap" }}>
                  <span>📁 {sel.category}</span><span>📅 {sel.created_at}</span>
                  <span>👤 {users.find(u => u.id === sel.created_by)?.name}</span>
                  <span>🔧 {users.find(u => u.id === sel.assigned_to)?.name || "Sin asignar"}</span>
                </div>
              </div>
              {(currentUser.role === "admin" || currentUser.role === "tech") && (
                <div style={{ background: "#f8f8f8", border: "1px solid #eee", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 500 }}>Acciones</h3>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#888" }}>Estado</label>
                      <select value={sel.status} onChange={e => updateTicket(sel.id, { status: e.target.value as Status }, `Estado cambiado a ${e.target.value}`)} style={{ display: "block", marginTop: 4, fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd" }}>
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    {currentUser.role === "admin" && (
                      <div>
                        <label style={{ fontSize: 12, color: "#888" }}>Asignar a</label>
                        <select value={sel.assigned_to ?? ""} onChange={e => { const uid = e.target.value ? parseInt(e.target.value) : null; const name = uid ? users.find(u => u.id === uid)?.name : "Sin asignar"; updateTicket(sel.id, { assigned_to: uid }, `Asignado a ${name}`); }} style={{ display: "block", marginTop: 4, fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd" }}>
                          <option value="">Sin asignar</option>
                          {users.filter(u => u.role === "tech").map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 500 }}>Agregar comentario</h3>
                <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Escribí tu comentario..." style={{ width: "100%", height: 56, resize: "vertical", padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 13, fontFamily: "system-ui", boxSizing: "border-box" }} />
                <button onClick={() => addComment(sel.id)} style={{ marginTop: 8, background: "#185FA5", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Comentar</button>
              </div>
              <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 14 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 500 }}>Historial</h3>
                {ticketHistory(sel.id).map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#378ADD", marginTop: 5, flexShrink: 0 }} />
                    <div style={{ fontSize: 13 }}>
                      <span style={{ color: "#888" }}>{new Date(h.created_at).toLocaleDateString()}</span>
                      <span style={{ marginLeft: 8 }}><strong>{h.user_name}</strong> — {h.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "reportes" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 18px" }}>Reportes</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>Tickets por estado</h3>
                  {STATUSES.map(s => { const count = tickets.filter(t => t.status === s).length; const pct = tickets.length ? Math.round((count / tickets.length) * 100) : 0; return (
                    <div key={s} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span>{s}</span><span style={{ fontWeight: 500 }}>{count}</span></div>
                      <div style={{ background: "#f0f0f0", borderRadius: 4, height: 8 }}><div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: statusColor[s] }} /></div>
                    </div>
                  ); })}
                </div>
                <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>Tickets por prioridad</h3>
                  {PRIORITIES.map(p => { const count = tickets.filter(t => t.priority === p).length; const pct = tickets.length ? Math.round((count / tickets.length) * 100) : 0; return (
                    <div key={p} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span>{p}</span><span style={{ fontWeight: 500 }}>{count}</span></div>
                      <div style={{ background: "#f0f0f0", borderRadius: 4, height: 8 }}><div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: priorityColor[p] }} /></div>
                    </div>
                  ); })}
                </div>
                <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>Tickets por técnico</h3>
                  {users.filter(u => u.role === "tech").map(u => { const count = tickets.filter(t => t.assigned_to === u.id).length; const pct = tickets.length ? Math.round((count / tickets.length) * 100) : 0; return (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <Avatar initials={u.avatar} size={28} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{u.name}</div>
                        <div style={{ background: "#f0f0f0", borderRadius: 4, height: 6, marginTop: 3 }}><div style={{ width: `${pct}%`, height: 6, borderRadius: 4, background: "#1D9E75" }} /></div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{count}</span>
                    </div>
                  ); })}
                </div>
                <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>Tickets por categoría</h3>
                  {CATEGORIES.map(c => { const count = tickets.filter(t => t.category === c).length; if (!count) return null; const pct = Math.round((count / tickets.length) * 100); return (
                    <div key={c} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span>{c}</span><span style={{ fontWeight: 500 }}>{count}</span></div>
                      <div style={{ background: "#f0f0f0", borderRadius: 4, height: 8 }}><div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: "#185FA5" }} /></div>
                    </div>
                  ); })}
                </div>
              </div>
            </div>
          )}
          {view === "usuarios" && (
            <UsuariosPanel users={users} onRefresh={loadAll} />
          )}
        </div>
      </div>
    </div>
  );
}