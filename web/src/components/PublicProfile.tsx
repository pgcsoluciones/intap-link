import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

type PublicLink = { id: string; label: string; url: string };

type PublicGalleryItem = {
  image_key: string;
  image_url?: string | null; // viene resuelto por la API nueva (Plan B assets endpoint)
};

type PublicFaq = { question: string; answer: string };

type PublicEntitlements = {
  canUseVCard: boolean;
  maxLinks: number;
  maxPhotos: number;
  maxFaqs: number;
};

type PublicData = {
  profileId: string;
  slug: string;
  themeId: string;
  name: string | null;
  bio: string | null;
  links: PublicLink[];
  gallery: PublicGalleryItem[];
  faqs: PublicFaq[] | null;
  entitlements: PublicEntitlements;
};

function getSlugFromQueryOrPath(): string | undefined {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("slug") || undefined;
    return q?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function normalizeApiBase(raw: string): string {
  // evita doble // y permite que VITE_API_URL venga con o sin / al final
  return (raw || "").replace(/\/+$/, "");
}

function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-2xl font-bold mb-2">Perfil no encontrado</div>
        <div className="text-white/70 text-sm mb-6">
          Verifica el enlace o intenta nuevamente.
        </div>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 bg-white text-black font-medium"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-white/70 text-sm">Cargando perfil...</div>
    </div>
  );
}

export default function PublicProfile() {
  const params = useParams();
  const slugFromParams = (params as any)?.slug as string | undefined;
  const slugFromQuery = useMemo(() => getSlugFromQueryOrPath(), []);
  const slug = (slugFromParams || slugFromQuery || "").trim();

  const apiBase = useMemo(() => {
    const env = (import.meta as any).env?.VITE_API_URL || "";
    return normalizeApiBase(env);
  }, []);

  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!slug) {
        setLoading(false);
        setErrorStatus(404);
        return;
      }

      setLoading(true);
      setErrorStatus(null);

      try {
        const url = `${apiBase}/api/v1/public/profiles/${encodeURIComponent(slug)}`;
        const res = await fetch(url, { method: "GET" });

        if (!res.ok) {
          if (!cancelled) {
            setErrorStatus(res.status);
            setData(null);
            setLoading(false);
          }
          return;
        }

        const json = (await res.json()) as PublicData;

        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setErrorStatus(500);
          setData(null);
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [apiBase, slug]);

  if (loading) return <Loading />;
  if (errorStatus || !data) return <NotFound />;

  // Avatar: usa la primera imagen de galería si existe, pero ahora por image_url (no construimos URL falsa)
  const avatarUrl =
    data.gallery?.[0]?.image_url && String(data.gallery[0].image_url).trim()
      ? String(data.gallery[0].image_url)
      : null;

  const displayName =
    (data.name && data.name.trim()) || (data.slug ? data.slug : "Perfil");

  return (
    <div className="min-h-screen bg-black text-white flex justify-center px-4 pt-10 pb-14">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-24 h-24 rounded-full overflow-hidden border border-white/15 bg-white/5 flex items-center justify-center">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <span className="text-2xl font-bold text-white/60">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <h1 className="mt-4 text-2xl font-bold">{displayName}</h1>
          <p className="mt-2 text-sm text-white/70 leading-relaxed px-2">
            {data.bio || "Bienvenido a mi perfil digital."}
          </p>
        </div>

        {/* Links */}
        <div className="mt-6 space-y-3">
          {(data.links || []).map((l) => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-center font-medium"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Gallery */}
        {Array.isArray(data.gallery) && data.gallery.length > 0 && (
          <div className="mt-8">
            <div className="text-sm font-semibold text-white/80 mb-3">
              Galería
            </div>
            <div className="grid grid-cols-3 gap-2">
              {data.gallery
                .filter((g) => g.image_url && String(g.image_url).trim())
                .map((g) => (
                  <a
                    key={g.image_key}
                    href={String(g.image_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square rounded-lg overflow-hidden border border-white/10 bg-white/5"
                    title="Ver imagen"
                  >
                    <img
                      src={String(g.image_url)}
                      alt="Galería"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </a>
                ))}
            </div>
          </div>
        )}

        {/* FAQs */}
        {data.faqs && data.faqs.length > 0 && (
          <div className="mt-8 text-left">
            <div className="text-sm font-semibold text-white/80 mb-3">
              Preguntas frecuentes
            </div>
            <div className="space-y-3">
              {data.faqs.map((f, idx) => (
                <details
                  key={`${idx}-${f.question}`}
                  className="rounded-xl border border-white/12 bg-white/5 px-4 py-3"
                >
                  <summary className="cursor-pointer font-medium">
                    {f.question}
                  </summary>
                  <div className="mt-2 text-sm text-white/70 leading-relaxed">
                    {f.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-10 text-center text-xs text-white/50">
          <Link to="/" className="hover:text-white/80 transition">
            Crea tu propio perfil en <span className="font-semibold">INTAP LINK</span>
          </Link>
        </footer>
      </div>
    </div>
  );
}
