"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, CalendarDays, Pencil, Trash2, Bell, Clock, CheckCircle, Ban } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";

interface Release {
  id: string;
  releaseName: string;
  releaseDate: string;
  retailPriceCents: number | null;
  imageUrl: string | null;
  description: string | null;
  sneakerId: string | null;
  status: string;
  createdAt: string;
  sneaker: { id: string; brand: string; model: string; imageUrl: string | null } | null;
  _count: { reminders: number };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  upcoming: { label: "Upcoming", color: "bg-blue-100 text-blue-700", icon: Clock },
  released: { label: "Released", color: "bg-green-100 text-green-700", icon: CheckCircle },
  sold_out: { label: "Sold Out", color: "bg-red-100 text-red-700", icon: Ban },
};

const EMPTY_FORM = {
  releaseName: "",
  releaseDate: "",
  retailPriceCents: "",
  imageUrl: "",
  description: "",
  status: "upcoming",
};

export default function AdminReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [editRelease, setEditRelease] = useState<Release | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Release | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchReleases();
  }, []);

  async function fetchReleases() {
    const res = await fetch("/api/admin/releases");
    if (res.ok) setReleases(await res.json());
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.releaseName || !form.releaseDate) return;
    setCreating(true);
    const res = await fetch("/api/admin/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        releaseName: form.releaseName,
        releaseDate: form.releaseDate,
        retailPriceCents: form.retailPriceCents ? parseInt(form.retailPriceCents) : null,
        imageUrl: form.imageUrl || null,
        description: form.description || null,
        status: form.status,
      }),
    });
    if (res.ok) {
      toast("Release created", "success");
      setShowCreate(false);
      setForm(EMPTY_FORM);
      fetchReleases();
    } else {
      const data = await res.json();
      toast(data.error || "Failed to create release", "error");
    }
    setCreating(false);
  }

  function openEdit(release: Release) {
    setEditRelease(release);
    setEditForm({
      releaseName: release.releaseName,
      releaseDate: release.releaseDate.slice(0, 16), // datetime-local format
      retailPriceCents: release.retailPriceCents ? String(release.retailPriceCents) : "",
      imageUrl: release.imageUrl || "",
      description: release.description || "",
      status: release.status,
    });
    setShowEdit(true);
  }

  async function handleEdit() {
    if (!editRelease || !editForm.releaseName || !editForm.releaseDate) return;
    setSaving(true);
    const res = await fetch(`/api/admin/releases/${editRelease.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        releaseName: editForm.releaseName,
        releaseDate: editForm.releaseDate,
        retailPriceCents: editForm.retailPriceCents ? parseInt(editForm.retailPriceCents) : null,
        imageUrl: editForm.imageUrl || null,
        description: editForm.description || null,
        status: editForm.status,
      }),
    });
    if (res.ok) {
      toast("Release updated", "success");
      setShowEdit(false);
      setEditRelease(null);
      fetchReleases();
    } else {
      const data = await res.json();
      toast(data.error || "Failed to update release", "error");
    }
    setSaving(false);
  }

  function openDelete(release: Release) {
    setDeleteTarget(release);
    setShowDelete(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/releases/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast("Release deleted", "success");
      setShowDelete(false);
      setDeleteTarget(null);
      fetchReleases();
    } else {
      const data = await res.json();
      toast(data.error || "Failed to delete release", "error");
    }
    setDeleting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Release Calendar</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Create Release
        </button>
      </div>

      {releases.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)] opacity-40" />
          <p className="text-sm text-[var(--muted-foreground)]">No releases yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {releases.map((release) => {
            const cfg = STATUS_CONFIG[release.status] || STATUS_CONFIG.upcoming;
            const StatusIcon = cfg.icon;

            return (
              <div key={release.id} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--muted)]">
                      <CalendarDays className="h-5 w-5 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{release.releaseName}</h3>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {release.sneaker
                          ? `${release.sneaker.brand} ${release.sneaker.model}`
                          : "No sneaker linked"}
                        {release.retailPriceCents
                          ? ` \u00B7 ${formatPrice(release.retailPriceCents)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    <button
                      onClick={() => openEdit(release)}
                      className="rounded-md border border-[var(--border)] p-2 text-sm hover:bg-[var(--muted)] transition-colors"
                      title="Edit release"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openDelete(release)}
                      className="rounded-md border border-[var(--border)] p-2 text-sm hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                      title="Delete release"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                  <span>Release: {new Date(release.releaseDate).toLocaleDateString()}</span>
                  <span className="inline-flex items-center gap-1">
                    <Bell className="h-3 w-3" />
                    {release._count.reminders} reminder{release._count.reminders !== 1 ? "s" : ""}
                  </span>
                </div>
                {release.description && (
                  <p className="mt-2 text-sm text-[var(--muted-foreground)] line-clamp-2">
                    {release.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Release">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Release Name *</label>
            <input
              type="text"
              value={form.releaseName}
              onChange={(e) => setForm({ ...form, releaseName: e.target.value })}
              placeholder="e.g. Air Jordan 1 Retro High OG"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Release details for users"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Release Date *</label>
              <input
                type="datetime-local"
                value={form.releaseDate}
                onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Retail Price (cents)</label>
              <input
                type="number"
                min="0"
                value={form.retailPriceCents}
                onChange={(e) => setForm({ ...form, retailPriceCents: e.target.value })}
                placeholder="e.g. 17000"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Image URL</label>
            <input
              type="text"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="upcoming">Upcoming</option>
              <option value="released">Released</option>
              <option value="sold_out">Sold Out</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 rounded-md border border-[var(--border)] py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !form.releaseName || !form.releaseDate}
              className="flex-1 rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Release
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Release">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Release Name *</label>
            <input
              type="text"
              value={editForm.releaseName}
              onChange={(e) => setEditForm({ ...editForm, releaseName: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Release Date *</label>
              <input
                type="datetime-local"
                value={editForm.releaseDate}
                onChange={(e) => setEditForm({ ...editForm, releaseDate: e.target.value })}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Retail Price (cents)</label>
              <input
                type="number"
                min="0"
                value={editForm.retailPriceCents}
                onChange={(e) => setEditForm({ ...editForm, retailPriceCents: e.target.value })}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Image URL</label>
            <input
              type="text"
              value={editForm.imageUrl}
              onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="upcoming">Upcoming</option>
              <option value="released">Released</option>
              <option value="sold_out">Sold Out</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowEdit(false)}
              className="flex-1 rounded-md border border-[var(--border)] py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={saving || !editForm.releaseName || !editForm.releaseDate}
              className="flex-1 rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Release">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            Are you sure you want to delete <strong>{deleteTarget?.releaseName}</strong>? This will
            also remove all reminders set by users. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDelete(false)}
              className="flex-1 rounded-md border border-[var(--border)] py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 rounded-md bg-red-600 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete Release
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
