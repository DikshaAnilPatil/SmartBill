import { useEffect, useState } from "react";
import {
  Download,
  Edit2,
  Eye,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { fmt, fmtK } from "@shared/utils/format";
import {
  Btn,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Toast,
} from "@shared/components/common/ui";
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "@shared/api/supplierAPI";

export default function SuppliersScreen() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [viewSupplier, setViewSupplier] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    gst: "",
    balance: 0,
    status: "Active",
  });
  const [toast, setToast] = useState(null);

  // Local editable list (so added suppliers appear below in the table)
  const [supplierList, setSupplierList] = useState([]);

  const [form, setForm] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    gst: "",
    balanceDue: "0",
  });


useEffect(() => {
  loadSuppliers();
}, []);

const loadSuppliers = async () => {
  try {
    const data = await fetchSuppliers();
    setSupplierList(data.suppliers);
  } catch (err) {
    console.log(err);
  }
};

const filtered = supplierList.filter((s) =>
  s.name.toLowerCase().includes(search.toLowerCase())
);


  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-5">
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {deleteId !== null && (
        <ConfirmDialog
          message="This will permanently delete the supplier."
          onConfirm={async () => {
  try {
    await deleteSupplier(deleteId);

    await loadSuppliers();

    setDeleteId(null);

    showToast("Supplier deleted successfully", "success");
  } catch (err) {
    console.log(err);
  }
}}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {viewSupplier && (
        <Modal title="Supplier Details" onClose={() => setViewSupplier(null)}>
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Firm Name
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {viewSupplier.name}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contact Person
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {viewSupplier.contact || "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {viewSupplier.phone || "—"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {viewSupplier.email || "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  City
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {viewSupplier.city || "—"}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Address
              </p>
              <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">
                {viewSupplier.address || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Balance Due
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {fmt(viewSupplier.balance || 0)}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {showEditModal && editId !== null && (
        <Modal
          title="Edit Supplier"
          onClose={() => {
            setShowEditModal(false);
            setEditId(null);
          }}
        >
          <div className="space-y-4">
            <Input
              label="Firm Name"
              value={editForm.name}
              onChange={(v) => setEditForm((f) => ({ ...f, name: v }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Contact Person"
                value={editForm.contact}
                onChange={(v) => setEditForm((f) => ({ ...f, contact: v }))}
              />
              <Input
                label="Phone"
                icon={<Phone className="w-4 h-4" />}
                value={editForm.phone}
                onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))}
              />
            </div>
            <Input
              label="Email"
              icon={<Mail className="w-4 h-4" />}
              value={editForm.email}
              onChange={(v) => setEditForm((f) => ({ ...f, email: v }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="City"
                value={editForm.city}
                onChange={(v) => setEditForm((f) => ({ ...f, city: v }))}
              />
              <Input
                label="GST Number"
                value={editForm.gst}
                onChange={(v) => setEditForm((f) => ({ ...f, gst: v }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Address
              </label>
              <textarea
                rows={4}
                value={editForm.address}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, address: e.target.value }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setEditId(null);
                }}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                onClick={async () => {
                 try {
  await updateSupplier(editId, {
    name: editForm.name,
    contact: editForm.contact,
    phone: editForm.phone,
    email: editForm.email,
    city: editForm.city,
    address: editForm.address,
    gst: editForm.gst,
    status: editForm.status,
  });

  await loadSuppliers();

  setShowEditModal(false);
  setEditId(null);

  showToast("Supplier updated successfully", "success");
} catch (err) {
  console.log(err);
}
                }}
                className="flex-1 justify-center"
              >
                Save Changes
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal title="Add New Supplier" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Input
              label="Firm Name"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Contact Person"
                value={form.contact}
                onChange={(v) => setForm((f) => ({ ...f, contact: v }))}
              />
              <Input
                label="Phone"
                icon={<Phone className="w-4 h-4" />}
                value={form.phone}
                onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              />
            </div>
            <Input
              label="Email"
              icon={<Mail className="w-4 h-4" />}
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="City"
                value={form.city}
                onChange={(v) => setForm((f) => ({ ...f, city: v }))}
              />
              <Input
                label="GST Number"
                value={form.gst}
                onChange={(v) => setForm((f) => ({ ...f, gst: v }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Address
              </label>
              <textarea
                rows={4}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                onClick={() => setShowModal(false)}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                onClick={async () => {
  try {
    await createSupplier({
      name: form.name,
      contact: form.contact,
      phone: form.phone,
      email: form.email,
      city: form.city,
      address: form.address,
      gst: form.gst,
    });

    await loadSuppliers();

    setShowModal(false);

    setForm({
      name: "",
      contact: "",
      phone: "",
      email: "",
      city: "",
      address: "",
      gst: "",
      balanceDue: "0",
    });

    showToast("Supplier added successfully", "success");
  } catch (err) {
    console.log(err);
  }
}}
                className="flex-1 justify-center"
              >
                Save Supplier
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={setSearch}
          icon={<Search className="w-4 h-4" />}
        />
        <Btn
          variant="primary"
          size="md"
          onClick={() => setShowModal(true)}
          icon={<Plus className="w-4 h-4" />}
        >
          Add Supplier
        </Btn>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  "Supplier",
                  "Contact",
                  "Phone",
                  "City",
                  "Address",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className={`text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${h === "Address" ? "min-w-[220px]" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((s) => (
                <tr
                  key={s._id}
                  className="hover:bg-slate-50 transition-colors group align-top"
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.email}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{s.contact}</td>
                  <td className="px-5 py-4 text-slate-600 font-mono text-xs">
                    {s.phone}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{s.city}</td>
                  <td className="px-5 py-4 text-slate-600 align-top min-w-[220px] max-w-[260px]">
                    <span className="block whitespace-pre-line break-words">
                      {s.address || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">

                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEditModal(true);
                          setEditId(s._id);
                          setEditForm({
                            name: s.name,
                            contact: s.contact,
                            phone: s.phone,
                            email: s.email,
                            city: s.city,
                            address: s.address || "",
                            gst: s.gst || "",
                            balance: s.balance,
                            status: s.status,
                          });
                        }}
                        icon={<Edit2 className="w-3.5 h-3.5" />}
                      />
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(s._id);
                        }}
                        icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}




