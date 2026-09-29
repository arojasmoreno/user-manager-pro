/**
 * English (United Kingdom). Keys are the Spanish source strings — see
 * `src/i18n/index.tsx`. Any key missing here falls back to Spanish.
 */
export const en: Record<string, string> = {
  // Navegación y acciones
  "Acceso": "Access",
  "Acceso con código por correo · Sin contraseñas": "Email code access · No passwords",
  "Acceso restringido": "Restricted access",
  "Administrador": "Administrator",
  "Añadir ficha": "Add sheet",
  "Añadir usuario": "Add user",
  "Añade un documento al catálogo y asígnalo a los centros donde se utiliza.":
    "Add a document to the catalogue and assign it to the sites where it is used.",
  "Añade usuarios con su nombre, rol y centros. Bloquea o elimina cuentas cuando haga falta.":
    "Add users with their name, role and sites. Block or delete accounts whenever needed.",
  "Abrir mi espacio": "Open my workspace",
  "Mi espacio": "My workspace",
  "Cargando…": "Loading…",
  "Idioma": "Language",
  "Ir a la página principal": "Go to the home page",
  "Volver al inicio": "Back to home",
  "Cerrar sesión": "Log out",
  "Salir": "Log out",
  "Volverás a esta página justo después de iniciar sesión.":
    "You will return to this page right after signing in.",
  "Reintentar": "Try again",
  "Recargar los datos": "Reload the data",
  "Verificando…": "Verifying…",
  "Verificar y entrar": "Verify and sign in",
  "Enviar código": "Send code",
  "Usar otro correo": "Use another email",
  "Revisa tu correo": "Check your email",
  "Guardar": "Save",
  "Guardar cambios": "Save changes",
  "Cancelar": "Cancel",
  "Editar": "Edit",
  "Eliminar": "Delete",
  "Gestionar": "Manage",
  "Bloquear": "Block",
  "Desbloquear": "Unblock",
  "Bloqueado": "Blocked",
  "Revocar": "Revoke",
  "Buscar por título, producto o fabricante…": "Search by title, product or manufacturer…",
  "Reintentar ": "Try again ",

  // Estados y errores
  "Error": "Error",
  "Error 404": "Error 404",
  "Algo ha fallado en la aplicación": "Something went wrong in the application",
  "Página no encontrada": "Page not found",
  "La dirección que buscas no existe o ha cambiado. Vuelve al inicio para seguir trabajando con tus fichas.":
    "The address you are looking for does not exist or has changed. Go back home to keep working with your sheets.",
  "No se ha podido cargar": "Could not load",
  "Cuenta bloqueada": "Account blocked",
  "Un administrador ha bloqueado esta cuenta. Si crees que es un error, contacta con la persona que gestiona los accesos de tu organización.":
    "An administrator has blocked this account. If you think this is a mistake, contact whoever manages access in your organisation.",
  "No se pudo enviar el código. Inténtalo de nuevo.":
    "The code could not be sent. Please try again.",
  "El código introducido no es correcto.": "The code you entered is not correct.",

  // Acceso
  "Entra con tu correo": "Sign in with your email",
  "Te enviaremos un código de seis dígitos. Sin contraseñas.":
    "We will send you a six-digit code. No passwords.",
  "Correo electrónico": "Email address",
  "Verificación": "Verification",
  "Registra el acceso por correo con nombre, rol y centros. Al verificar su código, la cuenta se crea ya con estos permisos.":
    "Register email access with a name, a role and sites. Once the code is verified, the account is created with those permissions.",
  "¿Primera vez? La primera cuenta que inicia sesión puede convertirse en administradora. Si tu administrador ya te invitó, tu nombre, rol y centros se aplicarán automáticamente al verificar el código.":
    "First time here? New accounts always start as a standard user. If your administrator has already invited you, your name, role and sites are applied automatically when you verify the code.",

  // Landing
  "Gestión de usuarios · Documentación técnica · Seguridad química":
    "User management · Technical documentation · Chemical safety",
  "Cada centro, con su documentación.": "Every site, with its own documentation.",
  "Nada más, nada menos.": "Nothing more, nothing less.",
  "Doc Manager organiza fichas técnicas, fichas de seguridad, manuales e instrucciones de trabajo por centro de trabajo. Los administradores gestionan personas y permisos; cada usuario consulta exactamente la documentación de su centro.":
    "Doc Manager organises technical sheets, safety sheets, manuals and work instructions by site. Administrators manage people and permissions; each user sees exactly the documentation for their own site.",
  "Usuarios con nombre, rol y centro": "Users with a name, a role and a site",
  "De cada usuario se gestionan su nombre, su centro de trabajo y su rol. Los administradores añaden, bloquean, eliminan y modifican cuentas.":
    "Each user's name, site and role are managed here. Administrators add, block, delete and edit accounts.",
  "Cuatro tipos de documento": "Four document types",
  "Fichas técnicas, fichas de seguridad, manuales de instrucciones e instrucciones de trabajo, siempre asignados a un centro.":
    "Technical sheets, safety sheets, instruction manuals and work instructions, always assigned to a site.",
  "Cada usuario solo ve las fichas de sus centros. Los administradores ven y gestionan todo el catálogo.":
    "Each user only sees the sheets from their own sites. Administrators see and manage the whole catalogue.",
  "Cómo funciona": "How it works",
  "El administrador crea los centros de trabajo": "The administrator creates the sites",
  "Cada centro se registra con nombre, código y dirección. Es el eje del catálogo: toda ficha pertenece a uno o varios centros.":
    "Each site is registered with a name, a code and an address. It is the backbone of the catalogue: every sheet belongs to one or more sites.",
  "Añade usuarios con nombre, rol y centros": "Add users with a name, a role and sites",
  "Cada persona recibe un acceso por correo. Al entrar, ya tiene su nombre, su rol y sus centros de trabajo listos.":
    "Each person gets email access. When they sign in, their name, role and work sites are already in place.",
  "Sube fichas y asígnalas a cada centro": "Upload sheets and assign them to each site",
  "Pega la URL donde está colgado el documento o súbelo directamente al almacenamiento del proyecto. Queda disponible desde el catálogo.":
    "Paste the URL where the document is hosted, or upload it straight to the project storage. It is then available from the catalogue.",
  "Tu centro, a un paso.": "Your site, one step away.",
  "Entra con tu correo y consulta la documentación de tu centro de trabajo.":
    "Sign in with your email and browse the documentation for your site.",
  "Doc Manager · Documentación por centro de trabajo":
    "Doc Manager · Documentation by work site",
  "Versión 1": "Version 1",
  "Loading...": "Loading...",

  // Catálogo documental
  "Fichas": "Sheets",
  "Catálogo documental": "Document catalogue",
  "Documento": "Document",
  "Nueva ficha": "New sheet",
  "Editar ficha": "Edit sheet",
  "Título": "Title",
  "Nombre de la ficha": "Sheet name",
  "Tipo de ficha": "Sheet type",
  "Ficha técnica": "Technical sheet",
  "Ficha de seguridad": "Safety sheet",
  "Manual de máquina": "Machine manual",
  "Instrucción de trabajo": "Work instruction",
  "Producto": "Product",
  "Producto o equipo (opcional)": "Product or equipment (optional)",
  "Fabricante": "Manufacturer",
  "Fabricante (opcional)": "Manufacturer (optional)",
  "Nombre del fabricante": "Manufacturer name",
  "https://… o sube un PDF": "https://… or upload a PDF",
  "Centro al que pertenece": "Site it belongs to",
  "Cada persona verá esta ficha si su centro está marcado aquí.":
    "Each person will see this sheet if their site is ticked here.",
  "Todavía no hay fichas aquí": "There are no sheets here yet",
  "1 ficha": "1 sheet",
  "{n} fichas": "{n} sheets",
  "1 usuario": "1 user",
  "{n} usuarios": "{n} users",

  // Centros
  "Centros": "Sites",
  "Organización": "Organisation",
  "Centros de trabajo": "Work sites",
  "Nuevo centro": "New site",
  "Nuevo centro de trabajo": "New work site",
  "Nombre": "Name",
  "Código": "Code",
  "Dirección": "Address",
  "Crear centro": "Create site",
  "Aún no hay centros": "No sites yet",
  "Todavía no hay centros. Créalos en la pestaña «Centros».":
    "There are no sites yet. Create them in the «Sites» tab.",
  "Crea el primer centro de trabajo para empezar a organizar usuarios y fichas.":
    "Create the first work site to start organising users and sheets.",
  "Crea primero un centro de trabajo en la pestaña «Centros».":
    "First create a work site in the «Sites» tab.",
  "Los centros son el eje del archivo: cada ficha y cada usuario se asigna a uno o varios.":
    "Sites are the backbone of the archive: each sheet and each user is assigned to one or more.",
  "Centros de trabajo de la organización. Cada ficha se asigna a uno o varios centros.":
    "The organisation's work sites. Each sheet is assigned to one or more sites.",
  "Personas": "People",
  "Cuentas": "Accounts",
  "Usuarios": "Users",
  "Usuario": "User",
  "Rol": "Role",
  "(tú)": "(you)",
  "Invitaciones pendientes": "Pending invitations",
  "Enviar invitación": "Send invitation",
  "Ver todas las fichas": "See all sheets",
};
