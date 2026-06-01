from __future__ import annotations

import json
import re
import subprocess
import sys
import ssl
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path.cwd()
API_DIR = ROOT / "api"
OUT_DIR = ROOT / "tmp" / "intap-reference"
OUT_DIR.mkdir(parents=True, exist_ok=True)

PROFILE_ID = "profile_jprez_demo"
USER_ID = "user_jprez_demo"
SLUG = "jprez"
SOURCE_URL = "https://enmajprez.intapcard.com/"

def run_wr(sql: str):
    cmd = [
        "npx",
        "wrangler",
        "d1",
        "execute",
        "DB",
        "--remote",
        "--json",
        "--command",
        sql,
    ]
    proc = subprocess.run(
        cmd,
        cwd=API_DIR,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.returncode != 0:
        print("\n=== SQL que falló ===")
        print(sql)
        print("\n=== STDERR ===")
        print(proc.stderr)
        raise SystemExit(proc.returncode)

    raw = proc.stdout.strip()
    if not raw:
        return []

    try:
        data = json.loads(raw)
    except Exception:
        print(raw)
        return []

    def find_results(obj):
        if isinstance(obj, dict):
            if "results" in obj and isinstance(obj["results"], list):
                return obj["results"]
            for value in obj.values():
                found = find_results(value)
                if found is not None:
                    return found
        if isinstance(obj, list):
            for item in obj:
                found = find_results(item)
                if found is not None:
                    return found
        return None

    return find_results(data) or []

def q(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace("'", "''")
    return f"'{text}'"

def table_columns(table: str) -> set[str]:
    rows = run_wr(f"PRAGMA table_info({table});")
    return {str(row.get("name")) for row in rows if row.get("name")}

def table_exists(table: str) -> bool:
    rows = run_wr(f"SELECT name FROM sqlite_master WHERE type='table' AND name={q(table)};")
    return bool(rows)

def insert_or_replace(table: str, data: dict):
    if not table_exists(table):
        print(f"Saltando {table}: no existe.")
        return

    cols = table_columns(table)
    payload = {k: v for k, v in data.items() if k in cols}

    if not payload:
        print(f"Saltando {table}: no hay columnas compatibles.")
        return

    col_sql = ", ".join(payload.keys())
    val_sql = ", ".join(q(v) for v in payload.values())
    run_wr(f"INSERT OR REPLACE INTO {table} ({col_sql}) VALUES ({val_sql});")
    print(f"OK insert/update {table}: {list(payload.keys())}")

def insert_row(table: str, data: dict):
    if not table_exists(table):
        print(f"Saltando {table}: no existe.")
        return

    cols = table_columns(table)
    payload = {k: v for k, v in data.items() if k in cols}

    if not payload:
        print(f"Saltando {table}: no hay columnas compatibles.")
        return

    col_sql = ", ".join(payload.keys())
    val_sql = ", ".join(q(v) for v in payload.values())
    run_wr(f"INSERT INTO {table} ({col_sql}) VALUES ({val_sql});")
    print(f"OK insert {table}: {payload.get('id', '')}")

def delete_profile_children():
    delete_map = [
        ("profile_links", "profile_id"),
        ("profile_social_links", "profile_id"),
        ("profile_faqs", "profile_id"),
        ("profile_gallery", "profile_id"),
        ("profile_products", "profile_id"),
        ("profile_contact", "profile_id"),
    ]

    for table, col in delete_map:
        if table_exists(table) and col in table_columns(table):
            run_wr(f"DELETE FROM {table} WHERE {col}={q(PROFILE_ID)};")
            print(f"OK limpieza {table}")

def backup_existing():
    backup = {"created_at": datetime.now().isoformat(), "slug": SLUG, "tables": {}}
    tables = [
        "profiles",
        "profile_contact",
        "profile_links",
        "profile_social_links",
        "profile_faqs",
        "profile_gallery",
        "profile_products",
    ]

    for table in tables:
        if not table_exists(table):
            continue
        cols = table_columns(table)
        if table == "profiles" and "slug" in cols:
            rows = run_wr(f"SELECT * FROM profiles WHERE slug={q(SLUG)};")
        elif "profile_id" in cols:
            rows = run_wr(f"SELECT * FROM {table} WHERE profile_id={q(PROFILE_ID)};")
        else:
            rows = []
        backup["tables"][table] = rows

    out = OUT_DIR / f"jprez-before-{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(backup, indent=2, ensure_ascii=False))
    print(f"Backup previo guardado en: {out}")

def fetch_reference_images():
    req = Request(SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
    context = ssl._create_unverified_context()
    html = urlopen(req, timeout=25, context=context).read().decode("utf-8", errors="ignore")
    (OUT_DIR / "enmajprez.html").write_text(html)

    urls = set()

    patterns = [
        r'https?:\\?/\\?/[^"\')<>\s]+?\.(?:png|jpg|jpeg|webp)',
        r'https?://[^"\')<>\s]+?\.(?:png|jpg|jpeg|webp)',
    ]

    for pattern in patterns:
        for item in re.findall(pattern, html, flags=re.I):
            clean = item.replace("\\/", "/").replace("&amp;", "&")
            urls.add(clean)

    image_urls = sorted(urls)

    reference = {
        "source": SOURCE_URL,
        "image_urls": image_urls,
    }

    (OUT_DIR / "enmajprez.reference.json").write_text(json.dumps(reference, indent=2, ensure_ascii=False))
    print(f"Detectadas {len(image_urls)} imágenes reales desde referencia.")

    return image_urls

def first_or_empty(items, index):
    return items[index] if index < len(items) else ""

def main():
    print("=== Semilla perfil /jprez ===")
    backup_existing()
    image_urls = fetch_reference_images()

    avatar_url = first_or_empty(image_urls, 0)
    logo_url = first_or_empty(image_urls, 1)

    gallery_images = image_urls[2:8]
    if len(gallery_images) < 4:
        gallery_images = image_urls[:6]

    template_data = {
        "accentColor": "#D62D2D",
        "title": "Gestor de Marketing y Ventas",
        "phone": "829 994 3102",
        "whatsapp": "18299943102",
        "email": "ventas@constructorajprez.com",
        "website": "constructorajprez.com",
        "address": "Av. Winston Churchill 1550, Plaza Orleans Local 213-214, Santo Domingo, República Dominicana",
        "mapUrl": "https://www.google.com/maps/search/?api=1&query=Plaza%20Orleans%20Av.%20Winston%20Churchill%20Santo%20Domingo",
        "instagram": "@enmanuelperez.jprez",
        "instagramUrl": "https://www.instagram.com/enmanuelperez.jprez",
        "facebook": "@constructorajprez",
        "facebookUrl": "https://www.facebook.com/constructorajprez",
        "companyName": "Constructora JPREZ",
        "companyLogo": logo_url,
        "contactTitle": "¡A tus órdenes!",
        "bioHeadline": "Tu propiedad ideal no está lejos. Empecemos hoy.",
        "bio": (
            "Hola, soy Enmanuel Pérez, gestor de marketing y ventas en JPREZ Constructora y asesor inmobiliario certificado por la AEI.\n\n"
            "Soy egresado de la carrera de Mercadeo en UNIBE, donde descubrí que el verdadero poder del marketing está en conectar personas con soluciones. "
            "Esa convicción me llevó a especializarme también en bienes raíces, combinando ambas áreas para ofrecer un servicio integral, que va desde la promoción efectiva hasta la asesoría personalizada en inversión inmobiliaria.\n\n"
            "No me limito a vender propiedades: me enfoco en generar confianza, resolver dudas y brindar una experiencia clara y profesional.\n\n"
            "Fuera del trabajo, me apasionan el deporte y la aventura. Creo en el equilibrio entre la vida profesional y personal, y esa misma energía es la que llevo a cada cliente, cada reunión, y cada proyecto.\n\n"
            "Si estás buscando más que un vendedor —alguien que entienda tus necesidades, hable tu idioma y esté contigo en cada paso—, estoy aquí para ayudarte a lograrlo.\n\n"
            "🏙️ ¿Tienes dudas? Estoy aquí para ayudarte."
        ),
        "companyHeadline": "Más de 22 años creando hogares llenos de vida.",
        "companyAbout": (
            "En Constructora JPREZ nos apasiona construir más que estructuras: creamos hogares con propósito, calidad y visión de futuro. "
            "Con más de 22 años de experiencia en el sector inmobiliario de República Dominicana, hemos entregado más de 1,300 viviendas y seguimos desarrollando comunidades con más de 400 unidades actualmente en ejecución.\n\n"
            "Nos mueve el compromiso con el bienestar de las familias dominicanas, integrando diseño innovador, sostenibilidad y eficiencia en cada proyecto. "
            "Creemos en hacer las cosas bien desde el principio, con ética, transparencia y un firme enfoque en la calidad y satisfacción de nuestros clientes.\n\n"
            "Nuestra visión se refleja en cada detalle de nuestras obras: espacios funcionales, modernos y con un enfoque humano. "
            "Trabajamos cada día para ser líderes en el sector de la construcción, aportando valor al país y creando oportunidades de inversión seguras y duraderas."
        ),
        "galleryHeadline": "Proyectos destacados",
        "servicesHeadline": "Soluciones integrales para construir con confianza",
        "servicesIntro": "En Constructora JPREZ te acompañamos en cada paso con un enfoque profesional, humano y de alta calidad:",
        "servicesList": (
            "Asesoría en Construcción::Te guiamos desde la planificación hasta la ejecución, asegurando que cada detalle cumpla con los más altos estándares de calidad.\n"
            "Financiamiento Personalizado::Brindamos opciones de financiamiento adaptadas a tus necesidades, facilitando el acceso a tu nuevo hogar.\n"
            "Postventa Garantizada::Nuestro compromiso continúa después de la entrega, ofreciendo soporte y atención para garantizar tu satisfacción total.\n"
            "Mantenimiento y Reparación::Contamos con un equipo especializado para mantener tu propiedad en óptimas condiciones a lo largo del tiempo.\n"
            "Asesoría Legal y Financiera::Simplificamos los trámites relacionados con tu propiedad, proporcionando orientación legal y financiera confiable."
        ),
        "companyContactHeadline": "¡Conecta con Constructora JPREZ!",
        "companyContactIntro": "Llámanos, escríbenos o síguenos en nuestras redes:",
        "companyPhone": "(809) 385-1616",
        "companyInstagram": "@constructorajprez",
        "companyFacebook": "@constructorajprez",
        "companyShortAddress": "Plaza Orleans, Av. Winston Churchill, Santo Domingo, R. D.",
        "faqHeadline": "Preguntas frecuentes sobre nuestros proyectos",
        "faqSubheadline": "Preguntas frecuentes sobre nuestros proyectos",
        "finalCtaTitle": "¿Aún tienes dudas?",
        "finalCtaText": "Escríbenos y recibe asesoría personalizada para elegir el proyecto ideal o resolver cualquier inquietud.",
        "finalCtaLabel": "Sí, tengo más dudas",
        "vcardLabel": "Agrégame a tus contactos",
        "chatTitle": "Enmanuel",
        "chatText": "Hola 👋 Gracias por tu interés en nuestros proyectos. ¿En qué puedo ayudarte hoy?",
        "chatMessage": "Hola Enmanuel, vi tu perfil digital y me interesa recibir información de los proyectos.",
        "chatButton1": "Quiero agendar una visita a un proyecto",
        "chatButton2": "¿Cuáles proyectos tienen actualmente disponibles?",
        "chatButton3": "¿Qué opciones de financiamiento ofrecen?",
        "chatButton4": "¿Tienes unidades para fines de AirBnB?",
    }

    delete_profile_children()

    insert_or_replace("users", {
        "id": USER_ID,
        "email": "jprez.demo@intaprd.com",
        "name": "Demo JPREZ",
        "created_at": "datetime('now')",
        "updated_at": "datetime('now')",
    })

    # El helper q() trata datetime('now') como texto si lo mandamos arriba.
    # Corregimos created_at/updated_at con UPDATE si las columnas existen.
    if table_exists("users"):
        user_cols = table_columns("users")
        update_parts = []
        if "created_at" in user_cols:
            update_parts.append("created_at=datetime('now')")
        if "updated_at" in user_cols:
            update_parts.append("updated_at=datetime('now')")
        if update_parts:
            run_wr(f"UPDATE users SET {', '.join(update_parts)} WHERE id={q(USER_ID)};")

    insert_or_replace("profiles", {
        "id": PROFILE_ID,
        "user_id": USER_ID,
        "slug": SLUG,
        "name": "Enmanuel Pérez",
        "bio": template_data["bio"],
        "category": "inmobiliaria",
        "subcategory": "constructora",
        "plan_id": "pro",
        "plan": "pro",
        "theme_id": "light",
        "theme": "light",
        "button_style": "rounded",
        "accent_color": "#D62D2D",
        "avatar_url": avatar_url,
        "is_published": 1,
        "is_active": 1,
        "active": 1,
        "template_id": "intap_profile_v2",
        "template_data": json.dumps(template_data, ensure_ascii=False),
        "blocks_order": json.dumps(
            ["contact", "bio", "gallery", "company", "services", "social", "faqs", "cta"],
            ensure_ascii=False,
        ),
        "created_at": "datetime('now')",
        "updated_at": "datetime('now')",
    })

    if table_exists("profiles"):
        profile_cols = table_columns("profiles")
        update_parts = []
        if "created_at" in profile_cols:
            update_parts.append("created_at=COALESCE(created_at, datetime('now'))")
        if "updated_at" in profile_cols:
            update_parts.append("updated_at=datetime('now')")
        if update_parts:
            run_wr(f"UPDATE profiles SET {', '.join(update_parts)} WHERE id={q(PROFILE_ID)};")

    insert_or_replace("profile_contact", {
        "id": "contact_jprez_demo",
        "profile_id": PROFILE_ID,
        "whatsapp": "18299943102",
        "phone": "829 994 3102",
        "email": "ventas@constructorajprez.com",
        "website": "constructorajprez.com",
        "address": "Av. Winston Churchill 1550, Plaza Orleans Local 213-214, Santo Domingo, República Dominicana",
        "map_url": "https://www.google.com/maps/search/?api=1&query=Plaza%20Orleans%20Av.%20Winston%20Churchill%20Santo%20Domingo",
        "hours": "Disponible para asesoría y visitas coordinadas",
        "created_at": "datetime('now')",
        "updated_at": "datetime('now')",
    })

    links = [
        ("link_jprez_wa", "Escríbenos por WhatsApp", "https://wa.me/18299943102?text=Hola%20Enmanuel%2C%20vi%20tu%20perfil%20digital%20y%20me%20interesa%20recibir%20informaci%C3%B3n.", 1, 1),
        ("link_jprez_instagram", "@enmanuelperez.jprez", "https://www.instagram.com/enmanuelperez.jprez", 0, 2),
        ("link_jprez_email", "ventas@constructorajprez.com", "mailto:ventas@constructorajprez.com", 0, 3),
        ("link_jprez_web", "constructorajprez.com", "https://constructorajprez.com", 0, 4),
        ("link_jprez_map", "Ubicación", "https://www.google.com/maps/search/?api=1&query=Plaza%20Orleans%20Av.%20Winston%20Churchill%20Santo%20Domingo", 0, 5),
    ]

    for link_id, label, url, is_cta, sort in links:
        insert_or_replace("profile_links", {
            "id": link_id,
            "profile_id": PROFILE_ID,
            "label": label,
            "title": label,
            "url": url,
            "is_cta": is_cta,
            "active": 1,
            "is_active": 1,
            "sort_order": sort,
            "created_at": "datetime('now')",
            "updated_at": "datetime('now')",
        })

    socials = [
        ("social_jprez_instagram", "instagram", "https://www.instagram.com/enmanuelperez.jprez", 1),
        ("social_jprez_company_instagram", "instagram", "https://www.instagram.com/constructorajprez", 2),
        ("social_jprez_facebook", "facebook", "https://www.facebook.com/constructorajprez", 3),
    ]

    for social_id, social_type, url, sort in socials:
        insert_or_replace("profile_social_links", {
            "id": social_id,
            "profile_id": PROFILE_ID,
            "type": social_type,
            "url": url,
            "enabled": 1,
            "is_active": 1,
            "sort_order": sort,
            "created_at": "datetime('now')",
            "updated_at": "datetime('now')",
        })

    project_titles = [
        ("PRADO RESIDENCES 4", "Evaristo Morales, Santo Domingo", "Torre residencial con tipologías modernas y áreas comunes de alto nivel."),
        ("PRADO RESIDENCES 3", "Ensanche Paraíso, Santo Domingo", "Diseño contemporáneo con espacios optimizados y excelente ubicación."),
        ("PRADO SUITES PUERTO PLATA", "Puerto Plata", "Proyecto de inversión frente al Golf de Playa Dorada."),
        ("PRADO SUITES LAS TERRENAS", "Las Terrenas", "Proyecto de inversión con administración tipo hotel, a minutos de la playa."),
    ]

    for index, (title, caption, desc) in enumerate(project_titles, start=1):
        image = gallery_images[index - 1] if index - 1 < len(gallery_images) else avatar_url
        insert_or_replace("profile_gallery", {
            "id": f"gallery_jprez_{index}",
            "profile_id": PROFILE_ID,
            "image_key": f"jprez/reference/{index}.png",
            "image_url": image,
            "alt": title,
            "title": title,
            "caption": caption,
            "sort_order": index,
            "created_at": "datetime('now')",
            "updated_at": "datetime('now')",
        })

        insert_or_replace("profile_products", {
            "id": f"product_jprez_{index}",
            "profile_id": PROFILE_ID,
            "name": title,
            "title": title,
            "description": desc,
            "image_url": image,
            "price": "",
            "currency": "DOP",
            "cta_label": "Más información",
            "cta_url": "https://wa.me/18299943102?text=Hola%20Enmanuel%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20" + title.replace(" ", "%20"),
            "is_featured": 1 if index == 1 else 0,
            "active": 1,
            "is_active": 1,
            "sort_order": index,
            "created_at": "datetime('now')",
            "updated_at": "datetime('now')",
        })

    faqs = [
        ("¿Cómo puedo solicitar una visita a uno de los proyectos?", "Puedes solicitar una visita contactándonos por WhatsApp, redes sociales o completando el formulario de contacto para coordinar una cita."),
        ("¿Cuáles son los métodos de financiamiento disponibles?", "Constructora JPREZ ofrece orientación y referimientos a entidades bancarias para créditos hipotecarios según el proyecto y el perfil del cliente."),
        ("¿Cuáles son los plazos de entrega de los proyectos?", "Los plazos de entrega varían según el proyecto. El equipo mantiene a los clientes informados durante todo el proceso."),
        ("¿Qué garantías ofrecen en sus propiedades?", "La constructora ofrece garantías según las condiciones del proyecto y los términos establecidos al momento de la compra."),
        ("¿Puedo personalizar mi propiedad habitacional?", "Sí, en algunos proyectos se permiten personalizaciones durante la fase de construcción, siempre coordinadas con antelación."),
        ("¿Cuál es el retorno de inversión?", "El retorno depende del proyecto, ubicación y comportamiento del mercado inmobiliario. JPREZ desarrolla proyectos en zonas con potencial de crecimiento."),
        ("¿Cuál es el plazo de inversión?", "El plazo de inversión varía según el proyecto y el objetivo del comprador o inversionista."),
        ("¿Cuál es el nivel de riesgo?", "Como toda inversión inmobiliaria, existe riesgo de mercado. JPREZ busca mitigarlo con proyectos bien ubicados y planificación profesional."),
    ]

    for index, (question, answer) in enumerate(faqs, start=1):
        insert_or_replace("profile_faqs", {
            "id": f"faq_jprez_{index}",
            "profile_id": PROFILE_ID,
            "question": question,
            "answer": answer,
            "active": 1,
            "is_active": 1,
            "sort_order": index,
            "created_at": "datetime('now')",
            "updated_at": "datetime('now')",
        })

    print("")
    print("=== PERFIL JPREZ LISTO ===")
    print("URL local: http://localhost:5174/jprez")
    print("URL prod cuando despliegues: https://intaprd.com/jprez")
    print("")
    print("Imágenes usadas:")
    for item in image_urls[:10]:
        print("-", item)

if __name__ == "__main__":
    main()
