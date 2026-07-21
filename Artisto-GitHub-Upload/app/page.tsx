"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import { FaAmazon, FaArtstation, FaDeviantart, FaDiscord, FaEnvelope, FaEtsy, FaFacebook, FaGlobe, FaInstagram, FaLinkedin, FaShopify, FaTiktok, FaWhatsapp, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { getAccessToken, getSupabaseBrowserClient } from "../lib/supabase/client";
import { GeoapifyAutocompleteField, GeoapifyLocationPicker, GeoapifyMarketplaceMap, type GeoapifyPlace } from "../components/Geoapify";
import { contactPlatformLabels, contactPlatforms, inferLegacyPlatform, validateContactLink, type ContactLink, type ContactPlatform } from "../lib/contacts";

type View = "search" | "map" | "sell" | "saved" | "account" | "form" | "admin" | "admin-account" | "admin-sell";
type Profile = { id: string; username: string | null; display_name: string; profile_completed: boolean; role: "user" | "admin" };
type AdminUserSummary = Pick<Profile, "id" | "username" | "display_name" | "profile_completed" | "role">;
type AdminTarget = { profile: Profile; listings: Listing[]; savedCount: number };
type SortMode = "newest" | "highest" | "lowest" | "saved";
type Listing = {
  id: string; ownerId?: string; title: string; category: string; description: string; price: number;
  location: string; latitude?: number | null; longitude?: number | null; seller: string; sellerUsername?: string | null; contact: string;
  contactLinks?: ContactLink[]; crop: string; imagePath?: string | null; imageUrl?: string | null; views: number; saves: number; createdAt?: string | null;
  originalSeller?: string; displayNameOverride?: string | null; displayNameOverrideEnabled?: boolean;
};

const seedListings: Listing[] = [
  { id: "demo-1", title: "Sunset Glaze Ceramic Vase", category: "Ceramics", description: "A hand-thrown stoneware vase finished in a warm sunset glaze. Each piece is shaped and painted in our small lakeside studio, so no two are quite alike.", price: 68, location: "The Beaches, Toronto", latitude: 43.6764, longitude: -79.2995, seller: "Coastal Clay Studio", contact: "mailto:hello@coastalclay.ca", crop: "8% 37%", views: 246, saves: 38 },
  { id: "demo-2", title: "Coastal Cliffs Original Painting", category: "Paintings", description: "An original acrylic landscape inspired by the cliffs and brilliant blue water of Georgian Bay. Framed and ready to hang.", price: 450, location: "Leslieville, Toronto", latitude: 43.6629, longitude: -79.3335, seller: "Sunset Art Collective", contact: "https://www.instagram.com", crop: "36% 37%", views: 512, saves: 74 },
  { id: "demo-3", title: "Ocean Tide Pendant Necklace", category: "Jewelry", description: "A delicate hand-finished pendant with natural stone and warm gold-filled chain. Designed in small batches by the lake.", price: 92, location: "Kensington Market, Toronto", latitude: 43.6545, longitude: -79.4007, seller: "Oceanic Jewels", contact: "https://www.etsy.com", crop: "64% 37%", views: 389, saves: 61 },
  { id: "demo-4", title: "Tropical Sunset Art Print", category: "Prints & Paper", description: "Archival art print from an original gouache painting, featuring quiet palms and a warm tropical sunset.", price: 28, location: "Parkdale, Toronto", latitude: 43.6405, longitude: -79.4387, seller: "Print & Press", contact: "https://www.instagram.com", crop: "92% 37%", views: 178, saves: 24 },
  { id: "demo-5", title: "Desert Bloom Woven Throw", category: "Textiles", description: "A soft woven throw inspired by desert evenings, finished by hand with generous tassels and earthy sunset colours.", price: 110, location: "Roncesvalles, Toronto", latitude: 43.6488, longitude: -79.4499, seller: "Woven by the Waves", contact: "https://www.etsy.com", crop: "8% 77%", views: 263, saves: 41 },
  { id: "demo-6", title: "Golden Hour Art Set", category: "Home Decor", description: "A cheerful hand-painted art set for a bright corner of your home. Includes the framed original and a small ceramic catchall.", price: 84, location: "Junction, Toronto", latitude: 43.6655, longitude: -79.4702, seller: "Golden Hour Goods", contact: "mailto:hello@goldenhour.ca", crop: "36% 77%", views: 321, saves: 56 },
  { id: "demo-7", title: "Quiet Moment Sculpture", category: "Sculpture", description: "A serene hand-carved limestone figure for a shelf, meditation nook, or quiet garden room.", price: 165, location: "Cabbagetown, Toronto", latitude: 43.6673, longitude: -79.3689, seller: "Sculpted Stories", contact: "https://www.instagram.com", crop: "64% 77%", views: 321, saves: 56 },
  { id: "demo-8", title: "Terracotta Arch Earrings", category: "Jewelry", description: "Playful lightweight clay earrings, shaped, painted, and assembled by hand in a tiny west-end studio.", price: 42, location: "West Queen West, Toronto", latitude: 43.6438, longitude: -79.4167, seller: "Little Studio Lane", contact: "https://www.etsy.com", crop: "92% 77%", views: 205, saves: 32 },
];

const canadaDemoListing: Listing = {
  id: "demo-geo-canada",
  title: "Rocky Mountain Watercolour",
  category: "Paintings",
  description: "A Geoapify map demo listing placed near Banff, Alberta so the Canadian marketplace search and booth marker can be tested.",
  price: 125,
  location: "Banff, Alberta, Canada",
  latitude: 51.1784,
  longitude: -115.5708,
  seller: "Artisto Demo Studio",
  contact: "https://www.instagram.com",
  crop: "36% 37%",
  views: 0,
  saves: 0,
};

const categories = ["All categories", "Paintings", "Prints", "Digital Art", "Jewelry", "Accessories", "Ceramics", "Clothing", "Stationery", "Home Decor", "Toys & Plushies", "Crafts", "Commissions", "Supplies", "Other"];
const MAX_LISTING_IMAGE_BYTES = 8 * 1024 * 1024;

function ProductImage({ listing, className = "" }: { listing: Listing; className?: string }) {
  if (listing.imageUrl) return <div className={`product-image uploaded-image ${className}`}><Image src={listing.imageUrl} alt={listing.title} fill sizes="(max-width: 700px) 50vw, (max-width: 1000px) 50vw, 25vw" /></div>;
  return <div className={`product-image ${className}`} style={{ backgroundPosition: listing.crop }} role="img" aria-label={listing.title} />;
}

function Logo({ onHome }: { onHome?: () => void }) {
  return <button className="logo" onClick={onHome} aria-label="Artisto home"><Image src="/artisto-logo-transparent.png" alt="Artisto" width={260} height={195} priority /></button>;
}

function Icon({ name }: { name: "search" | "map" | "sell" | "user" }) {
  return <span className={`icon icon-${name}`} aria-hidden="true"><span /></span>;
}

function App() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [view, setView] = useState<View>("search");
  const [listings, setListings] = useState(seedListings);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<User | null>(null);
  const loggedIn = Boolean(user);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [backendNotice, setBackendNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState("All categories");
  const [category, setCategory] = useState("All categories");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [editing, setEditing] = useState<Listing | null>(null);
  const [adminTarget, setAdminTarget] = useState<AdminTarget | null>(null);

  const loadListings = useCallback(async () => {
    try {
      const response = await fetch("/api/listings?limit=20", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to load listings.");
      setListings(result.listings as Listing[]);
      setBackendNotice("");
    } catch (error) {
      setBackendNotice(`Supabase setup pending: ${error instanceof Error ? error.message : "database unavailable"}`);
      setListings(seedListings);
    }
  }, []);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadSaves = useCallback(async () => {
    const response = await fetch("/api/saves", { headers: await authHeaders(), cache: "no-store" });
    if (!response.ok) return setSaved(new Set());
    const result = await response.json();
    setSaved(new Set(result.saved as string[]));
  }, [authHeaders]);

  useEffect(() => {
    queueMicrotask(() => void loadListings());
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setLoginOpen(false);
      else setProfileSetupOpen(false);
    });
    return () => listener.subscription.unsubscribe();
  }, [loadListings, supabase]);

  useEffect(() => {
    queueMicrotask(() => {
      if (user) void loadSaves();
      else setSaved(new Set());
    });
  }, [loadSaves, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getAccessToken().then(async token => {
      if (!token) return;
      const response = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok || cancelled) return;
      const result = await response.json();
      if (!cancelled) {
        setProfile(result.profile as Profile);
        setProfileSetupOpen(!result.profile?.profile_completed);
      }
    });
    return () => { cancelled = true; };
  }, [user]);

  const go = (next: View) => {
    if ((next === "sell" || next === "saved" || next === "account" || next === "form") && !loggedIn) {
      setLoginOpen(true); return;
    }
    if (next.startsWith("admin") && profile?.role !== "admin") return;
    setView(next); setProfileOpen(false);
    window.history.pushState({}, "", next === "search" ? "/" : `/?view=${next}`);
  };
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("view") as View | null;
      const listingId = params.get("listing");
      if (next && ["search", "map", "sell", "saved", "account", "form", "admin", "admin-account", "admin-sell"].includes(next)) setView(next);
      setSelected(listings.find(item => item.id === listingId) ?? null);
    };
    sync(); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync);
  }, [listings]);

  const openListing = (listing: Listing) => {
    setListings(items => items.map(x => x.id === listing.id ? { ...x, views: x.views + 1 } : x));
    setSelected(listing);
    if (!listing.id.startsWith("demo-")) void fetch(`/api/listings/${listing.id}/view`, { method: "POST" });
    const params = new URLSearchParams(window.location.search); params.set("listing", String(listing.id));
    window.history.pushState({}, "", `/?${params.toString()}`);
  };
  const closeListing = () => {
    setSelected(null); const params = new URLSearchParams(window.location.search); params.delete("listing");
    window.history.pushState({}, "", params.size ? `/?${params.toString()}` : "/");
  };
  const toggleSave = async (id: string) => {
    if (!loggedIn) { setLoginOpen(true); return; }
    if (id.startsWith("demo-")) { setBackendNotice("Run the included Supabase migration before saving demo listings."); return; }
    const wasSaved = saved.has(id);
    setSaved(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setListings(items => items.map(x => x.id === id ? { ...x, saves: Math.max(0, x.saves + (wasSaved ? -1 : 1)) } : x));
    const response = await fetch("/api/saves", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ listingId: id }) });
    if (!response.ok) {
      const result = await response.json(); setBackendNotice(result.error ?? "Unable to update saved listings.");
      setSaved(current => { const next = new Set(current); if (wasSaved) next.add(id); else next.delete(id); return next; });
      setListings(items => items.map(x => x.id === id ? { ...x, saves: Math.max(0, x.saves + (wasSaved ? 1 : -1)) } : x));
    }
  };

  const saveListing = async (form: FormData) => {
    const url = editing ? `/api/listings/${editing.id}` : "/api/listings";
    const response = await fetch(url, { method: editing ? "PATCH" : "POST", headers: await authHeaders(), body: form });
    const result = await response.json();
    if (!response.ok) return result.error ?? "Unable to save listing.";
    const listing = result.listing as Listing;
    setListings(items => editing ? items.map(item => item.id === editing.id ? listing : item) : [listing, ...items]);
    if (adminTarget && editing?.ownerId === adminTarget.profile.id) {
      setAdminTarget(current => current ? { ...current, listings: current.listings.map(item => item.id === editing.id ? listing : item) } : current);
      setEditing(null); setBackendNotice(""); go("admin-sell"); return null;
    }
    setEditing(null); setBackendNotice(""); go("sell"); return null;
  };

  const deleteListing = async () => {
    if (!editing) return null;
    const response = await fetch(`/api/listings/${editing.id}`, { method: "DELETE", headers: await authHeaders() });
    if (!response.ok) { const result = await response.json(); return result.error ?? "Unable to delete listing."; }
    setListings(items => items.filter(item => item.id !== editing.id));
    if (adminTarget && editing.ownerId === adminTarget.profile.id) {
      setAdminTarget(current => current ? { ...current, listings: current.listings.filter(item => item.id !== editing.id) } : current);
      setEditing(null); go("admin-sell"); return null;
    }
    setEditing(null); go("sell"); return null;
  };

  const filtered = useMemo(() => listings.filter(item => {
    const haystack = `${item.title} ${item.category} ${item.description} ${item.location} ${item.seller}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (category === "All categories" || item.category === category)
      && (!minPrice || item.price >= Number(minPrice)) && (!maxPrice || item.price <= Number(maxPrice));
  }).sort((a, b) => sortMode === "highest" ? b.price - a.price
    : sortMode === "lowest" ? a.price - b.price
    : sortMode === "saved" ? b.saves - a.saves
    : new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()), [listings, query, category, minPrice, maxPrice, sortMode]);

  const updateDisplayName = async (displayName: string) => {
    const token = await getAccessToken();
    if (!token) return "Your sign-in session expired.";
    const response = await fetch("/api/profile", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ displayName }) });
    const result = await response.json();
    if (!response.ok) return result.error ?? "Unable to update your display name.";
    setProfile(result.profile as Profile);
    await supabase.auth.updateUser({ data: { display_name: result.profile.display_name } });
    await loadListings();
    return null;
  };

  const loadAdminTarget = async (id: string) => {
    const response = await fetch(`/api/admin/users/${id}`, { headers: await authHeaders(), cache: "no-store" });
    const result = await response.json();
    if (!response.ok) return result.error ?? "Unable to load this user.";
    setAdminTarget(result as AdminTarget); setView("admin-account");
    window.history.pushState({}, "", "/?view=admin-account");
    return null;
  };

  const updateAdminDisplayName = async (displayName: string) => {
    if (!adminTarget) return "Choose a user first.";
    const response = await fetch(`/api/admin/users/${adminTarget.profile.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ displayName }) });
    const result = await response.json();
    if (!response.ok) return result.error ?? "Unable to update this display name.";
    setAdminTarget(current => current ? { ...current, profile: result.profile as Profile, listings: current.listings.map(item => ({ ...item, originalSeller: result.profile.display_name, seller: item.displayNameOverrideEnabled ? item.seller : result.profile.display_name })) } : current);
    await loadListings();
    return null;
  };

  const watercolorView = ["search", "sell", "account", "admin", "admin-account", "admin-sell"].includes(view);
  const adminMode = Boolean(adminTarget && ["admin-account", "admin-sell", "form"].includes(view) && editing?.ownerId === adminTarget.profile.id);
  return <main className={watercolorView ? "watercolor-background" : ""}>
    <Header view={view} loggedIn={loggedIn} isAdmin={profile?.role === "admin"} profileOpen={profileOpen} onProfile={() => loggedIn ? setProfileOpen(v => !v) : setLoginOpen(true)} go={go} logout={() => { void supabase.auth.signOut(); setProfileOpen(false); setProfile(null); setAdminTarget(null); setView("search"); }} />
    {backendNotice && <div className="backend-notice" role="status">{backendNotice}</div>}
    {view === "search" && <SearchPage listings={filtered} query={query} setQuery={setQuery} filterOpen={filterOpen} setFilterOpen={setFilterOpen} saved={saved} toggleSave={toggleSave} openListing={openListing} draftCategory={draftCategory} setDraftCategory={setDraftCategory} minPrice={minPrice} setMinPrice={setMinPrice} maxPrice={maxPrice} setMaxPrice={setMaxPrice} sortMode={sortMode} setSortMode={setSortMode} apply={() => { setCategory(draftCategory); setFilterOpen(false); }} clear={() => { setDraftCategory("All categories"); setCategory("All categories"); setMinPrice(""); setMaxPrice(""); setSortMode("newest"); }} />}
    {view === "map" && <MapPage listings={listings} openListing={openListing} />}
    {view === "sell" && <SellPage listings={listings.filter(item => item.ownerId === user?.id)} query={query} setQuery={setQuery} add={() => { setEditing(null); go("form"); }} edit={item => { setEditing(item); go("form"); }} />}
    {view === "saved" && <SavedPage listings={listings.filter(item => saved.has(item.id))} saved={saved} toggleSave={toggleSave} openListing={openListing} go={go} />}
    {view === "account" && <AccountPage profile={profile} listings={listings.filter(item => item.ownerId === user?.id)} savedCount={saved.size} updateDisplayName={updateDisplayName} providerLabel={user?.app_metadata?.provider === "google" ? "Google account" : "Account"} title="Your account" />}
    {view === "admin" && profile?.role === "admin" && <AdminUsersPage authHeaders={authHeaders} selectUser={loadAdminTarget} />}
    {view === "admin-account" && profile?.role === "admin" && adminTarget && <><AdminContextBar profile={adminTarget.profile} go={go} /><AccountPage profile={adminTarget.profile} listings={adminTarget.listings} savedCount={adminTarget.savedCount} updateDisplayName={updateAdminDisplayName} providerLabel="Administrator view" title="Account" /></>}
    {view === "admin-sell" && profile?.role === "admin" && adminTarget && <><AdminContextBar profile={adminTarget.profile} go={go} /><SellPage listings={adminTarget.listings} query={query} setQuery={setQuery} add={() => {}} edit={item => { setEditing(item); go("form"); }} allowAdd={false} /></>}
    {view === "form" && <ListingForm editing={editing} adminMode={adminMode} cancel={() => go(adminMode ? "admin-sell" : "sell")} save={saveListing} remove={deleteListing} />}
    {selected && <ListingModal listing={listings.find(x => x.id === selected.id) ?? selected} isSaved={saved.has(selected.id)} onSave={() => toggleSave(selected.id)} onClose={closeListing} />}
    {loginOpen && <GoogleLoginModal close={() => setLoginOpen(false)} />}
    {profileSetupOpen && user && <ProfileSetupModal user={user} complete={nextProfile => { setProfile(nextProfile); setProfileSetupOpen(false); void loadListings(); }} />}
  </main>;
}

function Header({ view, loggedIn, isAdmin, profileOpen, onProfile, go, logout }: { view: View; loggedIn: boolean; isAdmin: boolean; profileOpen: boolean; onProfile: () => void; go: (v: View) => void; logout: () => void }) {
  return <header className="site-header"><Logo onHome={() => go("search")} /><nav aria-label="Primary navigation">
    <button className={view === "search" ? "active" : ""} onClick={() => go("search")}><Icon name="search" />Search</button>
    <button className={view === "map" ? "active" : ""} onClick={() => go("map")}><Icon name="map" />Map</button>
    <button className={view === "sell" || view === "form" ? "active" : ""} onClick={() => go("sell")}><Icon name="sell" />Sell</button>
  </nav><div className="profile-wrap"><button className={`profile-button ${loggedIn ? "signed-in" : ""}`} onClick={onProfile} aria-label="Profile"><Icon name="user" /></button>
  {profileOpen && <div className="profile-menu"><button onClick={() => go("sell")}>My listings</button><button onClick={() => go("saved")}>Saved listings</button><button onClick={() => go("account")}>Account</button>{isAdmin && <><hr /><button className="admin-menu-link" onClick={() => go("admin")}>Admin users</button></>}<hr /><button onClick={logout}>Log out</button></div>}</div></header>;
}

function SearchPage(props: { listings: Listing[]; query: string; setQuery: (v: string) => void; filterOpen: boolean; setFilterOpen: (v: boolean) => void; saved: Set<string>; toggleSave: (id: string) => void; openListing: (l: Listing) => void; draftCategory: string; setDraftCategory: (v: string) => void; minPrice: string; setMinPrice: (v: string) => void; maxPrice: string; setMaxPrice: (v: string) => void; sortMode: SortMode; setSortMode: (v: SortMode) => void; apply: () => void; clear: () => void }) {
  return <section className="page search-page"><div className="search-row"><label className="search-field"><Icon name="search" /><input value={props.query} onChange={e => props.setQuery(e.target.value)} placeholder="Search art, items, artists, or neighbourhoods…" /></label><button className="primary-button filter-button" onClick={() => props.setFilterOpen(!props.filterOpen)}><span className="sliders">☷</span> Filter</button>
    {props.filterOpen && <div className="filter-popover"><div className="filter-title"><strong>Filters</strong><button onClick={() => props.setFilterOpen(false)}>×</button></div><label>Category<select value={props.draftCategory} onChange={e => props.setDraftCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><div className="price-grid"><label>Minimum price<input inputMode="decimal" value={props.minPrice} onChange={e => props.setMinPrice(e.target.value)} placeholder="$0" /></label><label>Maximum price<input inputMode="decimal" value={props.maxPrice} onChange={e => props.setMaxPrice(e.target.value)} placeholder="$500" /></label></div><fieldset className="sort-options"><legend>Organize items</legend>{([['newest','Newest'],['highest','Highest Price'],['lowest','Lowest Price'],['saved','Most Saved']] as [SortMode,string][]).map(([value,label]) => <label key={value}><input type="checkbox" checked={props.sortMode === value} onChange={() => props.setSortMode(value)} /> <span>{label}</span></label>)}</fieldset><div className="filter-actions"><button className="text-button" onClick={props.clear}>Clear filters</button><button className="primary-button small" onClick={props.apply}>Apply filters</button></div></div>}
  </div><div className="listing-grid">{props.listings.map(listing => <ListingCard key={listing.id} listing={listing} isSaved={props.saved.has(listing.id)} onSave={() => props.toggleSave(listing.id)} onOpen={() => props.openListing(listing)} />)}</div>{props.listings.length === 0 && <Empty title="No art found" body="Try another search or clear your filters." />}</section>;
}

function ListingCard({ listing, isSaved, onSave, onOpen }: { listing: Listing; isSaved: boolean; onSave: () => void; onOpen: () => void }) {
  return <article className="listing-card"><button className={`heart ${isSaved ? "saved" : ""}`} onClick={onSave} aria-label={isSaved ? "Unsave listing" : "Save listing"}>{isSaved ? "♥" : "♡"}</button><button className="card-open" onClick={onOpen}><ProductImage listing={listing} /><div className="card-copy"><p>{listing.category}</p><h2>{listing.title}</h2><small>by {listing.seller}</small><strong className="card-price">${listing.price.toFixed(2)}</strong></div></button></article>;
}

function MapPage({ listings, openListing }: { listings: Listing[]; openListing: (l: Listing) => void }) {
  const [preview, setPreview] = useState<Listing | null>(null);
  const [focus, setFocus] = useState<GeoapifyPlace | null>(null);
  const mapListings = listings.some(item => item.id === canadaDemoListing.id) ? listings : [...listings, canadaDemoListing];
  const pinned = mapListings.filter(item => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)) && !(Number(item.latitude) === 0 && Number(item.longitude) === 0));
  return <section className="map-page"><div className="map-toolbar"><GeoapifyAutocompleteField placeholder="Search a neighbourhood or address" onSelect={setFocus} className="map-geocoder" /></div><div className="map-canvas"><GeoapifyMarketplaceMap listings={mapListings} selectedId={preview?.id} onSelect={id => setPreview(mapListings.find(item => item.id === id) ?? null)} focus={focus} />{preview && <aside className="marker-preview"><button className="mini-close" onClick={() => setPreview(null)} aria-label="Close listing preview">×</button><ProductImage listing={preview} /><div className="marker-preview-copy"><span>{preview.category}</span><h2>{preview.title}</h2><strong>${preview.price.toFixed(2)}</strong><button className="primary-button small" onClick={() => openListing(preview)}>View listing</button></div></aside>}{pinned.length === 0 && <div className="map-empty">No booth locations yet. Sellers can add one when creating or editing a listing.</div>}</div></section>;
}

function SellPage({ listings, query, setQuery, add, edit, allowAdd = true }: { listings: Listing[]; query: string; setQuery: (v: string) => void; add: () => void; edit: (l: Listing) => void; allowAdd?: boolean }) {
  const matches = listings.filter(x => `${x.title} ${x.category}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="page sell-page"><h1>Listings</h1><div className={`seller-tools ${allowAdd ? "" : "without-add"}`}><label className="search-field"><Icon name="search" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search listings…" /></label>{allowAdd && <button className="primary-button" onClick={add}><span>＋</span> Add</button>}</div><div className="seller-list">{matches.map(item => <button className="seller-row" key={item.id} onClick={() => edit(item)}><ProductImage listing={item} /><div className="seller-copy"><h2>{item.title}</h2><p>{item.category}</p><strong>${item.price.toFixed(2)}</strong></div><div className="stats"><span><i className="eye-stat" /> {item.views}</span><span>♡ {item.saves}</span></div></button>)}</div></section>;
}

function SavedPage({ listings, saved, toggleSave, openListing, go }: { listings: Listing[]; saved: Set<string>; toggleSave: (id: string) => void; openListing: (l: Listing) => void; go: (v: View) => void }) {
  return <section className="page saved-page"><div className="page-heading"><div><span className="eyebrow">Your collection</span><h1>Saved listings</h1></div><button className="text-button" onClick={() => go("search")}>Keep exploring →</button></div>{listings.length ? <div className="listing-grid">{listings.map(item => <ListingCard key={item.id} listing={item} isSaved={saved.has(item.id)} onSave={() => toggleSave(item.id)} onOpen={() => openListing(item)} />)}</div> : <Empty title="Nothing saved yet" body="Tap the heart on any listing to keep it here." />}</section>;
}

function AccountPage({ profile, listings, savedCount, updateDisplayName, providerLabel, title }: { profile: Profile | null; listings: Listing[]; savedCount: number; updateDisplayName: (value: string) => Promise<string | null>; providerLabel: string; title: string }) {
  const name = profile?.display_name ?? "Artisto member";
  const owned = listings;
  const [editingName, setEditingName] = useState(false); const [draftName, setDraftName] = useState(name); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const saveName = async () => { setSaving(true); setError(""); const nextError = await updateDisplayName(draftName); setSaving(false); if (nextError) setError(nextError); else setEditingName(false); };
  return <section className="page account-page"><span className="eyebrow">Profile</span><h1>{title}</h1><div className="account-card"><div className="account-avatar"><Icon name="user" /></div><div className="account-identity">{editingName ? <div className="display-name-editor"><input value={draftName} maxLength={80} onChange={e => setDraftName(e.target.value)} aria-label="Display name" /><button disabled={saving} className="primary-button small" onClick={saveName}>{saving ? "Saving…" : "Save"}</button><button className="text-button" onClick={() => { setDraftName(name); setEditingName(false); setError(""); }}>Cancel</button></div> : <button className="editable-display-name" onClick={() => setEditingName(true)} title="Edit display name"><h2>{name}</h2><span>Edit</span></button>}<p>@{profile?.username ?? "username"}</p>{error && <small className="form-error">{error}</small>}</div><span className="account-provider">{providerLabel}</span></div><div className="account-grid"><div><strong>{savedCount}</strong><span>Saved pieces</span></div><div><strong>{owned.length}</strong><span>Active listings</span></div><div><strong>{owned.reduce((sum, item) => sum + item.views, 0).toLocaleString()}</strong><span>Total views</span></div></div></section>
}

function AdminUsersPage({ authHeaders, selectUser }: { authHeaders: () => Promise<Record<string, string>>; selectUser: (id: string) => Promise<string | null> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserSummary[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const search = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`, { headers: await authHeaders(), cache: "no-store" });
    const result = await response.json(); setBusy(false);
    if (!response.ok) { setResults([]); setError(result.error ?? "Unable to search users."); return; }
    setResults(result.users as AdminUserSummary[]);
  };
  const open = async (id: string) => { setBusy(true); setError(""); const nextError = await selectUser(id); setBusy(false); if (nextError) setError(nextError); };
  return <section className="page admin-users-page"><span className="eyebrow">Administrator</span><h1>User lookup</h1><p>Search by a user’s unique Artisto username.</p><form className="admin-user-search" onSubmit={search}><label className="search-field"><span>@</span><input required value={query} onChange={event => setQuery(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="unique_username" aria-label="Unique username" /></label><button className="primary-button" disabled={busy}>{busy ? "Searching…" : "Search users"}</button></form>{error && <p className="form-error" role="alert">{error}</p>}<div className="admin-user-results">{results.map(result => <button key={result.id} onClick={() => void open(result.id)} disabled={busy}><div className="account-avatar"><Icon name="user" /></div><span><strong>{result.display_name}</strong><small>@{result.username}</small></span><b>Open account →</b></button>)}</div>{!busy && query && results.length === 0 && !error && <p className="admin-empty">No matching username found.</p>}</section>;
}

function AdminContextBar({ profile, go }: { profile: Profile; go: (view: View) => void }) {
  return <div className="admin-context-bar"><button onClick={() => go("admin")}>← User lookup</button><div><span>Administrator view</span><strong>{profile.display_name} <small>@{profile.username}</small></strong></div><nav><button onClick={() => go("admin-account")}>Account</button><button onClick={() => go("admin-sell")}>Listings</button></nav></div>;
}

function ListingForm({ editing, adminMode, cancel, save, remove }: { editing: Listing | null; adminMode: boolean; cancel: () => void; save: (form: FormData) => Promise<string | null>; remove: () => Promise<string | null> }) {
  const [form, setForm] = useState({ title: editing?.title ?? "", description: editing?.description ?? "", category: editing?.category ?? "Ceramics", price: editing?.price.toString() ?? "", location: editing?.location ?? "" });
  const [online, setOnline] = useState(editing?.location.trim().toLowerCase() === "online");
  const [coordinates, setCoordinates] = useState({ latitude: editing?.location.trim().toLowerCase() === "online" ? null : editing?.latitude ?? null, longitude: editing?.location.trim().toLowerCase() === "online" ? null : editing?.longitude ?? null });
  const [contacts, setContacts] = useState<ContactLink[]>(editing?.contactLinks?.length ? editing.contactLinks : editing?.contact ? [{ platform: inferLegacyPlatform(editing.contact), value: editing.contact }] : [{ platform: "website", value: "" }]);
  const [contactErrors, setContactErrors] = useState<string[]>([]);
  const [overrideEnabled, setOverrideEnabled] = useState(Boolean(editing?.displayNameOverrideEnabled));
  const [overrideName, setOverrideName] = useState(editing?.displayNameOverride ?? "");
  const [imagePreview, setImagePreview] = useState<string | null>(null); const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false); const [formError, setFormError] = useState("");
  const update = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value });
  const onImage = (e: ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > MAX_LISTING_IMAGE_BYTES) { e.target.value = ""; setImageFile(null); setImagePreview(null); setFormError("Choose an image smaller than 8 MB."); return; } setFormError(""); setImageFile(file); setImagePreview(URL.createObjectURL(file)); };
  const submit = async (e: FormEvent) => { e.preventDefault(); if (!online && (!Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude))) { setFormError("Choose a Geoapify address suggestion or place the booth marker on the map."); return; } if (adminMode && overrideEnabled && !overrideName.trim()) { setFormError("Enter a listing display name or disable the override."); return; } const errors = contacts.map(contact => validateContactLink(contact).error ?? ""); setContactErrors(errors); if (!contacts.length || errors.some(Boolean)) { setFormError("Check every contact link before saving."); return; } if (new Set(contacts.map(contact => contact.platform)).size !== contacts.length) { setFormError("Each contact platform can be added only once."); return; } setSubmitting(true); setFormError(""); const payload = new FormData(); Object.entries(form).forEach(([key, value]) => payload.set(key, value)); payload.set("contactLinks", JSON.stringify(contacts)); payload.set("latitude", online ? "" : String(coordinates.latitude)); payload.set("longitude", online ? "" : String(coordinates.longitude)); if (adminMode) { payload.set("displayNameOverrideEnabled", String(overrideEnabled)); payload.set("displayNameOverride", overrideName); } if (imageFile) payload.set("image", imageFile); const error = await save(payload); setSubmitting(false); if (error) setFormError(error); };
  const deleteCurrent = async () => { setSubmitting(true); setFormError(""); const error = await remove(); setSubmitting(false); if (error) setFormError(error); };
  return <section className="page form-page">
    <button className="back-button" onClick={cancel}>← Back to listings</button>
    <div className="form-heading"><div><span className="eyebrow">{adminMode ? "Administrator editing" : "Seller studio"}</span><h1>{editing ? "Edit listing" : "Add a listing"}</h1><p>{adminMode ? "Changes apply to this listing only." : "Share one beautiful handmade piece with nearby art lovers."}</p></div><span className="step-pill">One image · 7 fields</span></div>
    <form onSubmit={submit} className="listing-form">
      <div className="form-main">
        <label>Title<input required value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g. Sunset glaze ceramic vase" /></label>
        <label>Description<textarea required rows={5} value={form.description} onChange={e => update("description", e.target.value)} placeholder="Tell buyers what makes this piece special…" /></label>
        <div className="form-grid"><label>Category<select value={form.category} onChange={e => update("category", e.target.value)}>{categories.slice(1).map(c => <option key={c}>{c}</option>)}</select></label><label>Price<div className="money-field"><span>$</span><input required inputMode="decimal" value={form.price} onChange={e => { const next = e.target.value.startsWith(".") ? `0${e.target.value}` : e.target.value; update("price", next); }} onBlur={() => { const parsed = Number(form.price); if (form.price.trim() && Number.isFinite(parsed)) update("price", parsed.toFixed(2)); }} placeholder="0.00" /></div></label></div>
        <label className={`location-label ${online ? "is-online" : ""}`}>Location<div className="location-mode-row"><div className="location-picker-wrap">{online ? <input value="online" disabled aria-label="Online listing location" /> : <GeoapifyLocationPicker value={form.location} latitude={coordinates.latitude} longitude={coordinates.longitude} onChange={place => { update("location", place.label); setCoordinates({ latitude: place.latitude, longitude: place.longitude }); }} />}</div><button type="button" className={`online-button ${online ? "active" : ""}`} onClick={() => { const next = !online; setOnline(next); update("location", next ? "online" : ""); setCoordinates({ latitude: null, longitude: null }); }}>Online</button></div></label>
        {adminMode && <section className="admin-override-editor"><div><strong>Listing display name override</strong><small>The creator’s original display name remains unchanged.</small></div><label className="override-toggle"><input type="checkbox" checked={overrideEnabled} onChange={event => setOverrideEnabled(event.target.checked)} /><span>{overrideEnabled ? "Override enabled" : "Use creator’s display name"}</span></label>{overrideEnabled && <label>Custom display name<input required maxLength={80} value={overrideName} onChange={event => setOverrideName(event.target.value)} placeholder={editing?.originalSeller ?? "Display name for this listing"} /></label>}</section>}
        <section className="contact-links-editor"><div className="contact-links-heading"><div><strong>Contact Links</strong><small>Add the places where shoppers can reach or follow you.</small></div><button type="button" className="outline-button small" disabled={contacts.length >= contactPlatforms.length} onClick={() => { const nextPlatform = contactPlatforms.find(platform => !contacts.some(contact => contact.platform === platform)); if (nextPlatform) setContacts([...contacts, { platform: nextPlatform, value: "" }]); }}>+ Add Contact Link</button></div>{contacts.map((contact, index) => <div className="contact-link-row" key={`${contact.platform}-${index}`}><select aria-label={`Contact platform ${index + 1}`} value={contact.platform} onChange={e => { const next = [...contacts]; next[index] = { platform: e.target.value as ContactPlatform, value: contact.value }; setContacts(next); setContactErrors([]); }}>{contactPlatforms.map(platform => <option key={platform} value={platform} disabled={contacts.some((item, itemIndex) => itemIndex !== index && item.platform === platform)}>{contactPlatformLabels[platform]}</option>)}</select><div><input aria-label={`${contactPlatformLabels[contact.platform]} contact`} value={contact.value} onChange={e => { const next = [...contacts]; next[index] = { ...contact, value: e.target.value }; setContacts(next); setContactErrors([]); }} placeholder={contact.platform === "email" ? "artist@example.com" : contact.platform === "whatsapp" ? "+1 416 555 0123 or wa.me link" : `${contactPlatformLabels[contact.platform]} link`} />{contactErrors[index] && <small className="contact-link-error">{contactErrors[index]}</small>}</div><button type="button" className="remove-contact" onClick={() => { setContacts(contacts.filter((_, itemIndex) => itemIndex !== index)); setContactErrors([]); }} aria-label={`Remove ${contactPlatformLabels[contact.platform]}`}>×</button></div>)}</section>
        {formError && <p className="form-error" role="alert">{formError}</p>}
      </div>
      <aside className="image-upload"><span>Listing image</span><label className={imagePreview || editing ? "has-image" : ""}>{imagePreview ? <Image src={imagePreview} alt="New listing preview" fill unoptimized /> : editing ? <ProductImage listing={editing} /> : <><span className="upload-icon">↑</span><strong>Choose one image</strong><small>JPG, PNG, or WebP · up to 8 MB</small></>}<input required={!editing} type="file" accept="image/jpeg,image/png,image/webp" onChange={onImage} /></label>{(imagePreview || editing) && <span className="upload-help">Choose another file above to replace this image.</span>}</aside>
      <div className="form-actions">{editing && <button disabled={submitting} type="button" className="danger-button" onClick={deleteCurrent}>Delete listing</button>}<span /><button disabled={submitting} type="button" className="outline-button" onClick={cancel}>Cancel</button><button disabled={submitting} className="primary-button" type="submit">{submitting ? "Saving…" : editing ? "Save changes" : "Publish listing"}</button></div>
    </form>
  </section>;
}

function PlatformIcon({ platform }: { platform: ContactPlatform }) {
  const icons = { instagram: FaInstagram, tiktok: FaTiktok, facebook: FaFacebook, x: FaXTwitter, youtube: FaYoutube, linkedin: FaLinkedin, etsy: FaEtsy, shopify: FaShopify, artstation: FaArtstation, deviantart: FaDeviantart, discord: FaDiscord, whatsapp: FaWhatsapp, website: FaGlobe, email: FaEnvelope, amazon: FaAmazon };
  const BrandIcon = icons[platform];
  return <BrandIcon aria-hidden="true" />;
}

function ListingModal({ listing, isSaved, onSave, onClose }: { listing: Listing; isSaved: boolean; onSave: () => void; onClose: () => void }) {
  const [contactsOpen, setContactsOpen] = useState(false);
  const links = listing.contactLinks?.length ? listing.contactLinks : listing.contact ? [{ platform: inferLegacyPlatform(listing.contact), value: listing.contact }] : [];
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><article className="listing-modal" role="dialog" aria-modal="true" aria-label={listing.title}><button className="modal-close" onClick={onClose} aria-label="Close listing">×</button><ProductImage listing={listing} className="modal-image" /><div className="modal-copy"><span className="eyebrow">{listing.category}</span><h1>{listing.title}</h1><p className="location-line"><Icon name="map" />{listing.location}</p><p className="description">{listing.description}</p><div className="seller-line"><div className="mini-avatar">A</div><div><small>Made and sold by</small><strong>{listing.seller}</strong>{listing.sellerUsername && <span className="seller-username">@{listing.sellerUsername}</span>}</div></div><div className="modal-footer"><strong className="modal-price">${listing.price.toFixed(2)}</strong><button className={`outline-button save-wide ${isSaved ? "saved" : ""}`} onClick={onSave}><span className="heart-glyph">{isSaved ? "♥" : "♡"}</span> {isSaved ? "Saved" : "Save"}</button><button className="primary-button" onClick={() => setContactsOpen(true)}>Contact seller</button></div></div>{contactsOpen && <div className="contact-popup" role="dialog" aria-modal="true" aria-label={`Contact ${listing.seller}`}><button className="modal-close" onClick={() => setContactsOpen(false)} aria-label="Close contact options">×</button><span className="eyebrow">Seller links</span><h2>Contact {listing.seller}</h2><p>Continue on one of the seller’s linked platforms.</p><div className="contact-platform-grid">{links.map(link => <a key={link.platform} href={link.value} target="_blank" rel="noreferrer" aria-label={`Open ${listing.seller} on ${contactPlatformLabels[link.platform]}`}><PlatformIcon platform={link.platform} /><span>{contactPlatformLabels[link.platform]}</span></a>)}</div></div>}</article></div>;
}

// Preserved for restoring email/password authentication after the Google-only launch phase.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LoginModal({ close }: { close: () => void }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const readableAuthError = (authError: { message: string; code?: string }) => {
    if (authError.code === "over_email_send_rate_limit" || /email rate limit/i.test(authError.message)) {
      return "Email signup is temporarily limited. Wait up to one hour or continue with Google.";
    }
    if (authError.code === "email_address_invalid") return "Enter a valid email address.";
    if (authError.code === "invalid_credentials") return "The email or password is incorrect.";
    return authError.message;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: email.split("@")[0] },
            emailRedirectTo: window.location.origin,
          },
        });
    submitting.current = false;
    setBusy(false);
    if (result.error) return setError(readableAuthError(result.error));
    if (mode === "signup" && !result.data.session) {
      setMessage("Confirmation requested. Check your inbox and spam folder. If it does not arrive, use Google sign-in or try again later.");
    }
  };

  const google = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (oauthError) {
      setError(readableAuthError(oauthError));
      submitting.current = false;
      setBusy(false);
    }
  };
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><form className="login-modal" onSubmit={submit}><button type="button" className="modal-close" onClick={close}>×</button><div className="login-mark"><Logo /></div><h1>{mode === "login" ? "Welcome to Artisto" : "Create your account"}</h1><p>{mode === "login" ? "Sign in to save art, contact artists, and share your own work." : "Join a local community of artists and art lovers."}</p><label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label><label>Password<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>{error && <p className="login-feedback error" role="alert">{error}</p>}{message && <p className="login-feedback">{message}</p>}<button disabled={busy} className="primary-button" type="submit">{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button><button className="outline-button" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Create account" : "Back to log in"}</button><div className="or"><span />or<span /></div><button disabled={busy} className="google-button" type="button" onClick={google}><b>G</b> Continue with Google</button><small>By continuing, you agree to Artisto’s terms and privacy policy.</small></form></div>
}

function GoogleLoginModal({ close }: { close: () => void }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const google = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href.split("#")[0] },
    });
    if (result.error) { setError(result.error.message); setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
    <article className="google-login-modal" role="dialog" aria-modal="true" aria-label="Sign in to Artisto">
      <button type="button" className="modal-close" onClick={close} aria-label="Close sign in">×</button>
      <div className="google-login-logo"><Logo /></div>
      <h1>Sign in to Artisto</h1>
      <p>Save local art and share your own creative work.</p>
      {error && <p className="login-feedback error" role="alert">{error}</p>}
      <button disabled={busy} className="google-oauth-button" type="button" onClick={google}><b>G</b><span>{busy ? "Opening Google…" : "Continue with Google"}</span></button>
      <small>Secure sign-in powered by Google and Supabase.</small>
    </article>
  </div>;
}

function ProfileSetupModal({ user, complete }: { user: User; complete: (profile: Profile) => void }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const suggestedName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").trim();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(suggestedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const token = await getAccessToken();
    if (!token) { setError("Your sign-in session expired. Please sign in again."); setBusy(false); return; }
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ username, displayName }),
    });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Unable to save your profile."); setBusy(false); return; }
    await supabase.auth.updateUser({ data: { display_name: displayName } });
    complete(result.profile as Profile);
  };
  return <div className="modal-backdrop profile-setup-backdrop"><form className="profile-setup-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Complete your Artisto profile">
    <span className="eyebrow">One last step</span>
    <h1>Choose your Artisto identity</h1>
    <p>Your username is unique. Your display name is what shoppers will see.</p>
    <label>Username<div className="username-field"><span>@</span><input autoFocus required minLength={3} maxLength={30} value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="your_username" /></div><small>3–30 lowercase letters, numbers, or underscores.</small></label>
    <label>Display name<input required maxLength={80} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your artist or personal name" /></label>
    {error && <p className="login-feedback error" role="alert">{error}</p>}
    <button disabled={busy} className="primary-button" type="submit">{busy ? "Saving…" : "Continue to Artisto"}</button>
  </form></div>;
}

function Empty({ title, body }: { title: string; body: string }) { return <div className="empty"><span>♡</span><h2>{title}</h2><p>{body}</p></div> }

export default function Home() { return <App />; }
