#!/usr/bin/env python3

import json
import re
import sys
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import (
    HTTPRedirectHandler,
    Request,
    build_opener,
    urlopen,
)

BASE = "https://intaprd.com"

INVENTORY = Path(
    "/tmp/intap-production-profiles.json"
)

OUTPUT = Path(
    "contracts/protected-profiles.production.json"
)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(
        self,
        req,
        fp,
        code,
        msg,
        headers,
        newurl,
    ):
        return None


def request(url, follow=True, agent=None):
    req = Request(
        url,
        headers={
            "User-Agent": (
                agent
                or "INTAP-Production-Audit/1.0"
            ),
            "Cache-Control": "no-cache",
            "Accept": "*/*",
        },
    )

    try:
        if follow:
            response = urlopen(
                req,
                timeout=40,
            )
        else:
            response = build_opener(
                NoRedirect()
            ).open(
                req,
                timeout=40,
            )

        with response:
            return {
                "status": response.status,
                "url": response.geturl(),
                "headers": {
                    str(k).lower(): str(v)
                    for k, v
                    in response.headers.items()
                },
                "body": response.read(),
            }

    except HTTPError as error:
        return {
            "status": error.code,
            "url": url,
            "headers": {
                str(k).lower(): str(v)
                for k, v
                in error.headers.items()
            },
            "body": error.read(),
        }

    except URLError as error:
        return {
            "status": 0,
            "url": url,
            "headers": {},
            "body": str(error).encode(),
        }


def text(result):
    return result["body"].decode(
        "utf-8",
        errors="replace",
    )


def clean(value):
    return re.sub(
        r"\s+",
        " ",
        str(value or ""),
    ).strip()


def get_meta(html, key):
    escaped = re.escape(key)

    patterns = [
        (
            r'<meta[^>]+'
            r'(?:property|name)=["\']'
            + escaped
            + r'["\'][^>]+'
            r'content=["\']([^"\']*)'
            r'["\']'
        ),
        (
            r'<meta[^>]+'
            r'content=["\']([^"\']*)'
            r'["\'][^>]+'
            r'(?:property|name)=["\']'
            + escaped
            + r'["\']'
        ),
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            html,
            re.I,
        )

        if match:
            return unescape(
                match.group(1).strip()
            )

    return ""


def get_title(html):
    match = re.search(
        r"<title[^>]*>(.*?)</title>",
        html,
        re.I | re.S,
    )

    if not match:
        return ""

    return clean(
        unescape(match.group(1))
    )


def get_canonical(html):
    match = re.search(
        r'<link[^>]+rel=["\']canonical["\']'
        r'[^>]+href=["\']([^"\']+)["\']',
        html,
        re.I,
    )

    if not match:
        match = re.search(
            r'<link[^>]+href=["\']([^"\']+)["\']'
            r'[^>]+rel=["\']canonical["\']',
            html,
            re.I,
        )

    return (
        unescape(match.group(1)).strip()
        if match
        else ""
    )


def jsonld_objects(html):
    blocks = re.findall(
        r'<script[^>]+type=["\']'
        r'application/ld\+json["\']'
        r'[^>]*>(.*?)</script>',
        html,
        re.I | re.S,
    )

    flattened = []

    def walk(value):
        if isinstance(value, list):
            for item in value:
                walk(item)

        elif isinstance(value, dict):
            flattened.append(value)

            graph = value.get("@graph")

            if graph is not None:
                walk(graph)

    for block in blocks:
        try:
            walk(
                json.loads(
                    unescape(block).strip()
                )
            )
        except Exception:
            pass

    return flattened


def jsonld_types(objects):
    types = set()

    for obj in objects:
        value = obj.get("@type")

        if isinstance(value, str):
            types.add(value)

        elif isinstance(value, list):
            for item in value:
                if isinstance(item, str):
                    types.add(item)

    return sorted(types)


def has_canonical_jsonld(objects, canonical):
    expected = canonical.rstrip("/")

    for obj in objects:
        for key in ("url", "@id"):
            value = obj.get(key)

            if not isinstance(value, str):
                continue

            candidate = value.rstrip("/")

            if candidate == expected:
                return True

            if candidate.startswith(
                expected + "#"
            ):
                return True

    return False


def has_address(objects):
    for obj in objects:
        address = obj.get("address")

        if isinstance(address, str):
            if address.strip():
                return True

        if isinstance(address, dict):
            if any(
                clean(address.get(k))
                for k in (
                    "streetAddress",
                    "addressLocality",
                    "addressRegion",
                    "addressCountry",
                )
            ):
                return True

    return False


def has_geo(objects):
    for obj in objects:
        geo = obj.get("geo")

        if not isinstance(geo, dict):
            continue

        if (
            clean(geo.get("latitude"))
            and clean(geo.get("longitude"))
        ):
            return True

    return False


payload = json.loads(
    INVENTORY.read_text(
        encoding="utf-8"
    )
)

rows = []

for result_set in payload:
    rows.extend(
        result_set.get("results") or []
    )

if not rows:
    raise SystemExit(
        "ERROR: inventario D1 vacío"
    )

errors = []

globals_data = {}

for name, url in {
    "robots": f"{BASE}/robots.txt",
    "sitemap": f"{BASE}/sitemap.xml",
    "llms": f"{BASE}/llms.txt",
}.items():

    result = request(url)

    globals_data[name] = {
        "url": url,
        "status": result["status"],
        "content_type":
            result["headers"].get(
                "content-type",
                "",
            ),
        "body": text(result),
    }

    if result["status"] != 200:
        errors.append(
            f"{name}: HTTP "
            f"{result['status']}"
        )


if "sitemap" not in (
    globals_data["robots"][
        "body"
    ].lower()
):
    errors.append(
        "robots.txt no declara sitemap"
    )


redirect_tests = [
    (
        "https://link.avanxy.com/novi",
        "https://intaprd.com/novi",
    ),
    (
        "https://link.avanxy.com/"
        "novi?ref=contract-test",
        "https://intaprd.com/"
        "novi?ref=contract-test",
    ),
    (
        "https://link.avanxy.com/"
        "aycdom2?source=contract",
        "https://intaprd.com/"
        "aycdom2?source=contract",
    ),
]

redirect_records = []

for source, expected in redirect_tests:
    result = request(
        source,
        follow=False,
    )

    location = result[
        "headers"
    ].get(
        "location",
        "",
    )

    redirect_records.append({
        "source": source,
        "status": result["status"],
        "location": location,
    })

    if result["status"] != 301:
        errors.append(
            f"{source}: HTTP "
            f"{result['status']}; "
            "esperado 301"
        )

    if location != expected:
        errors.append(
            f"{source}: destino "
            f"{location!r}; "
            f"esperado {expected!r}"
        )


profiles = []

seen = set()

for source in rows:

    slug = clean(
        source.get("slug")
    ).lower()

    canonical = f"{BASE}/{slug}"

    if slug in seen:
        errors.append(
            f"{slug}: slug duplicado"
        )

    seen.add(slug)

    page = request(
        canonical + "?audit=1",
        agent="Twitterbot/1.0",
    )

    html = text(page)

    api = request(
        f"{BASE}/api/v1/public/profiles/{slug}"
    )

    ai = request(
        f"{canonical}/ai.md"
    )

    facts = request(
        f"{canonical}/facts.json"
    )

    objects = jsonld_objects(html)
    types = jsonld_types(objects)

    title = get_title(html)

    description = get_meta(
        html,
        "description",
    )

    canonical_tag = get_canonical(html)

    og_url = get_meta(
        html,
        "og:url",
    )

    og_image = get_meta(
        html,
        "og:image",
    )

    twitter_image = get_meta(
        html,
        "twitter:image",
    )

    image = (
        request(og_image)
        if og_image
        else {
            "status": 0,
            "headers": {},
            "body": b"",
        }
    )

    latitude = clean(
        source.get("latitude")
    )

    longitude = clean(
        source.get("longitude")
    )

    address = clean(
        source.get("address")
    )

    profile_errors = []

    def fail(message):
        profile_errors.append(message)
        errors.append(
            f"{slug}: {message}"
        )

    if page["status"] != 200:
        fail(
            f"página HTTP {page['status']}"
        )

    if api["status"] != 200:
        fail(
            f"API HTTP {api['status']}"
        )

    if not title:
        fail(
            "falta title"
        )

    if not description:
        fail(
            "falta meta description"
        )

    if (
        canonical_tag.rstrip("/")
        != canonical
    ):
        fail(
            "canonical incorrecto: "
            + repr(canonical_tag)
        )

    if (
        og_url
        and og_url.rstrip("/")
        != canonical
    ):
        fail(
            "og:url incorrecto"
        )

    for key in (
        "og:type",
        "og:title",
        "og:description",
        "og:url",
        "og:image",
        "twitter:card",
        "twitter:title",
        "twitter:description",
        "twitter:image",
    ):
        if not get_meta(html, key):
            fail(
                f"falta {key}"
            )

    if (
        og_image
        and twitter_image
        and og_image != twitter_image
    ):
        fail(
            "og:image y twitter:image difieren"
        )

    if image["status"] != 200:
        fail(
            f"imagen social HTTP "
            f"{image['status']}"
        )

    image_type = image[
        "headers"
    ].get(
        "content-type",
        "",
    ).lower()

    if (
        image["status"] == 200
        and not image_type.startswith(
            "image/"
        )
    ):
        fail(
            "imagen social no devuelve "
            "content-type image/*"
        )

    if not get_meta(
        html,
        "og:image:width",
    ).isdigit():
        fail(
            "og:image:width ausente "
            "o inválido"
        )

    if not get_meta(
        html,
        "og:image:height",
    ).isdigit():
        fail(
            "og:image:height ausente "
            "o inválido"
        )

    robots_combined = (
        get_meta(html, "robots")
        + " "
        + page[
            "headers"
        ].get(
            "x-robots-tag",
            "",
        )
    ).lower()

    if "noindex" in robots_combined:
        fail(
            "perfil marcado noindex"
        )

    if not objects:
        fail(
            "falta JSON-LD"
        )

    if not types:
        fail(
            "JSON-LD sin @type"
        )

    if not has_canonical_jsonld(
        objects,
        canonical,
    ):
        fail(
            "JSON-LD sin URL canónica"
        )

    if (
        address
        and not has_address(objects)
    ):
        fail(
            "dirección D1 no reflejada "
            "en JSON-LD"
        )

    if bool(latitude) != bool(longitude):
        fail(
            "coordenadas incompletas"
        )

    if (
        latitude
        and longitude
        and not has_geo(objects)
    ):
        fail(
            "coordenadas no reflejadas "
            "en JSON-LD"
        )

    if ai["status"] != 200:
        fail(
            f"ai.md HTTP {ai['status']}"
        )

    if (
        ai["status"] == 200
        and len(ai["body"]) < 60
    ):
        fail(
            "ai.md demasiado corto"
        )

    facts_valid = False

    if facts["status"] == 200:
        try:
            json.loads(text(facts))
            facts_valid = True
        except Exception:
            pass

    if facts["status"] != 200:
        fail(
            f"facts.json HTTP "
            f"{facts['status']}"
        )

    elif not facts_valid:
        fail(
            "facts.json no es JSON válido"
        )

    sitemap_body = (
        globals_data[
            "sitemap"
        ]["body"]
    )

    if canonical not in sitemap_body:
        fail(
            "no aparece en sitemap.xml"
        )

    llms_body = (
        globals_data[
            "llms"
        ]["body"]
    )

    if (
        canonical not in llms_body
        and f"/{slug}" not in llms_body
    ):
        fail(
            "no aparece en llms.txt"
        )

    profiles.append({
        "profile_id":
            source.get("profile_id"),
        "slug":
            slug,
        "name":
            clean(source.get("name")),
        "plan_id":
            clean(source.get("plan_id")),
        "template_id":
            clean(
                source.get("template_id")
            ),
        "canonical":
            canonical,
        "contact": {
            "name":
                clean(
                    source.get(
                        "contact_name"
                    )
                ),
            "title":
                clean(
                    source.get(
                        "contact_title"
                    )
                ),
            "email":
                clean(
                    source.get("email")
                ),
            "phone":
                clean(
                    source.get("phone")
                ),
            "whatsapp":
                clean(
                    source.get("whatsapp")
                ),
        },
        "geo": {
            "address":
                address,
            "city":
                clean(
                    source.get("city")
                ),
            "country":
                clean(
                    source.get("country")
                ),
            "latitude":
                latitude,
            "longitude":
                longitude,
            "hours":
                clean(
                    source.get("hours")
                ),
            "map_url":
                clean(
                    source.get("map_url")
                ),
            "area_served":
                clean(
                    source.get(
                        "area_served"
                    )
                ),
            "jsonld_address":
                has_address(objects),
            "jsonld_geo":
                has_geo(objects),
        },
        "seo": {
            "title":
                title,
            "description":
                description,
            "canonical":
                canonical_tag,
            "robots":
                robots_combined.strip(),
        },
        "open_graph": {
            "title":
                get_meta(
                    html,
                    "og:title",
                ),
            "description":
                get_meta(
                    html,
                    "og:description",
                ),
            "url":
                og_url,
            "image":
                og_image,
            "width":
                get_meta(
                    html,
                    "og:image:width",
                ),
            "height":
                get_meta(
                    html,
                    "og:image:height",
                ),
        },
        "twitter": {
            "card":
                get_meta(
                    html,
                    "twitter:card",
                ),
            "image":
                twitter_image,
        },
        "jsonld": {
            "types":
                types,
            "objects":
                len(objects),
            "canonical":
                has_canonical_jsonld(
                    objects,
                    canonical,
                ),
        },
        "ai_discovery": {
            "ai_md_status":
                ai["status"],
            "facts_json_status":
                facts["status"],
            "facts_json_valid":
                facts_valid,
            "in_sitemap":
                canonical
                in sitemap_body,
            "in_llms":
                (
                    canonical in llms_body
                    or f"/{slug}"
                    in llms_body
                ),
        },
        "health": {
            "page":
                page["status"],
            "api":
                api["status"],
            "image":
                image["status"],
        },
        "errors":
            profile_errors,
    })


profiles.sort(
    key=lambda item: item["slug"]
)


contract = {
    "contract_version": 1,
    "generated_at": (
        datetime.now(
            timezone.utc
        )
        .replace(microsecond=0)
        .isoformat()
    ),
    "repository":
        "pgcsoluciones/intap-link",
    "canonical_domain":
        "intaprd.com",
    "production_branch":
        "main",
    "production_database":
        "intap_db",
    "production_pages_project":
        "intap-link",
    "approval_required":
        True,
    "approval_requires_exact_sha":
        True,
    "protected_profile_count":
        len(profiles),
    "legacy_redirects":
        redirect_records,
    "globals": {
        key: {
            "url": value["url"],
            "status": value["status"],
            "content_type":
                value["content_type"],
        }
        for key, value
        in globals_data.items()
    },
    "profiles":
        profiles,
    "audit": {
        "passed":
            not errors,
        "error_count":
            len(errors),
        "errors":
            errors,
    },
}


OUTPUT.write_text(
    json.dumps(
        contract,
        ensure_ascii=False,
        indent=2,
    ) + "\n",
    encoding="utf-8",
)


print()
print(
    "PERFILES AUDITADOS:",
    len(profiles),
)

for profile in profiles:

    marker = (
        "OK"
        if not profile["errors"]
        else "REVISAR"
    )

    print(
        f"{marker:7} "
        f"{profile['slug']:12} "
        f"{profile['seo']['title']}"
    )

    for error in profile["errors"]:
        print(
            "         -",
            error,
        )


print()
print(
    "REDIRECCIONES HISTÓRICAS:"
)

for item in redirect_records:
    print(
        " ",
        item["status"],
        item["source"],
        "->",
        item["location"],
    )


print()
print(
    "RESULTADO:",
    (
        "APROBADO"
        if not errors
        else "CON BRECHAS"
    ),
)

print(
    "INCIDENCIAS:",
    len(errors),
)


if errors:
    sys.exit(2)
