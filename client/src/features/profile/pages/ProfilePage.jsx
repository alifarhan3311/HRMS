import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Camera, CheckCircle2, Contact, KeyRound, Loader2, Mail, ShieldCheck,
  Trash2, UserRound, BriefcaseBusiness,
} from 'lucide-react';
import {
  useChangePasswordMutation,
  useGetMeQuery,
  useUpdateProfileMutation,
} from '../../auth/api/auth.api';
import { clearCredentials, setCredentials } from '../../auth/store/auth.slice';
import { Avatar } from '../../../components/ui/Avatar';
import Button from '../../../components/ui/Button';
import { Input, Select, Textarea } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { toast } from '../../../utils/toast';
import { getRoleLabel } from '../../../config/navigation';

const EMPTY_PROFILE = {
  fullName: '', fatherName: '', dateOfBirth: '', gender: '', maritalStatus: '',
  bloodGroup: '', contactNumber: '', address: '', emergencyContact: '', profilePicture: '',
};

function dateInput(value) {
  return value ? String(value).substring(0, 10) : '';
}

function compressProfilePicture(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please select an image file.'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('Image must be smaller than 5 MB.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Invalid image file.'));
      image.onload = () => {
        const maxSize = 512;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (dataUrl.length > 700000) return reject(new Error('Compressed image is still too large. Choose a smaller image.'));
        resolve(dataUrl);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value || '—'}</p>
    </div>
  );
}

export default function ProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const { data, isLoading } = useGetMeQuery();
  const user = data?.data?.user;
  const [activeTab, setActiveTab] = useState('profile');
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [processingImage, setProcessingImage] = useState(false);
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: changingPassword }] = useChangePasswordMutation();

  useEffect(() => {
    if (!user) return;
    setForm({
      ...EMPTY_PROFILE,
      fullName: user.fullName || '',
      fatherName: user.fatherName || '',
      dateOfBirth: dateInput(user.dateOfBirth),
      gender: user.gender || '',
      maritalStatus: user.maritalStatus || '',
      bloodGroup: user.bloodGroup || '',
      contactNumber: user.contactNumber || '',
      address: user.address || '',
      emergencyContact: user.emergencyContact || '',
      profilePicture: user.profilePicture || '',
    });
  }, [user]);

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function choosePicture(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProcessingImage(true);
    try {
      set('profilePicture', await compressProfilePicture(file));
      toast.success('Photo ready. Click Save Profile to upload it.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setProcessingImage(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (form.fullName.trim().length < 2) return toast.error('Full name is required.');
    try {
      const response = await updateProfile(form).unwrap();
      dispatch(setCredentials(response.data.user));
      toast.success('Profile updated successfully.');
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Could not update profile.');
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (password.newPassword.length < 8) return toast.error('New password must be at least 8 characters.');
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password.newPassword)) {
      return toast.error('New password must include uppercase, lowercase and a number.');
    }
    if (password.newPassword !== password.confirmPassword) return toast.error('Passwords do not match.');
    try {
      await changePassword(password).unwrap();
      dispatch(clearCredentials());
      toast.success('Password changed. Please sign in again.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Could not change password.');
    }
  }

  if (isLoading || !user) {
    return <div className="space-y-5"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" />
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          <div className="relative -mt-12 w-fit">
            <Avatar name={form.fullName} src={form.profilePicture} size="2xl" className="ring-4 ring-background shadow-xl" />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={processingImage}
              className="absolute -bottom-1 -right-1 rounded-full bg-primary p-2 text-primary-foreground shadow-lg transition-transform hover:scale-105 disabled:opacity-60"
              title="Change profile photo">
              {processingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={choosePicture} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold">{user.fullName}</h1>
            <p className="text-sm text-muted-foreground">{user.designation || getRoleLabel(user.role)} · {user.department || 'Department not assigned'}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Active account
          </div>
        </div>
      </motion.section>

      <div className="flex gap-2 rounded-xl border border-border bg-card p-1.5">
        <Button variant={activeTab === 'profile' ? 'primary' : 'ghost'} onClick={() => setActiveTab('profile')} className="gap-2">
          <UserRound className="h-4 w-4" /> Profile Details
        </Button>
        <Button variant={activeTab === 'security' ? 'primary' : 'ghost'} onClick={() => setActiveTab('security')} className="gap-2">
          <ShieldCheck className="h-4 w-4" /> Password & Security
        </Button>
      </div>

      {activeTab === 'profile' ? (
        <form onSubmit={saveProfile} className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="glass-card space-y-5 p-6">
            <div className="flex items-center gap-2"><Contact className="h-5 w-5 text-primary" /><h2 className="font-semibold">Personal & Contact Information</h2></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full Name" required value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
              <Input label="Father Name" value={form.fatherName} onChange={(e) => set('fatherName', e.target.value)} />
              <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
              <Select label="Gender" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">Not specified</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </Select>
              <Select label="Marital Status" value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
                <option value="">Not specified</option><option value="single">Single</option><option value="married">Married</option><option value="divorced">Divorced</option><option value="widowed">Widowed</option>
              </Select>
              <Select label="Blood Group" value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
                <option value="">Not specified</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'].map((group) => <option key={group} value={group}>{group === 'Unknown' ? 'Not Known' : group}</option>)}
              </Select>
              <Input label="Contact Number" value={form.contactNumber} onChange={(e) => set('contactNumber', e.target.value)} />
              <Input label="Emergency Contact" value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} />
              <div className="sm:col-span-2"><Textarea label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
            </div>
            <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
              {form.profilePicture && <Button type="button" variant="ghost" className="gap-2 text-destructive" onClick={() => set('profilePicture', '')}><Trash2 className="h-4 w-4" /> Remove Photo</Button>}
              <Button type="submit" disabled={saving || processingImage} className="ml-auto gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Profile</Button>
            </div>
          </div>
          <aside className="glass-card h-fit space-y-4 p-5">
            <div className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary" /><h2 className="font-semibold">Employment</h2></div>
            <Detail label="Employee Code" value={user.employeeCode} />
            <Detail label="Email" value={user.email} />
            <Detail label="Role" value={getRoleLabel(user.role)} />
            <Detail label="Department" value={user.department} />
            <Detail label="Designation" value={user.designation} />
            <Detail label="Shift" value={user.shift?.name} />
            <p className="text-xs text-muted-foreground">Employment details are controlled by HR.</p>
          </aside>
        </form>
      ) : (
        <form onSubmit={savePassword} className="glass-card max-w-2xl space-y-5 p-6">
          <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-4">
            <KeyRound className="mt-0.5 h-5 w-5 text-primary" />
            <div><h2 className="font-semibold">Change Password</h2><p className="text-sm text-muted-foreground">After changing your password, all sessions will be signed out.</p></div>
          </div>
          <Input label="Current Password" required type="password" value={password.currentPassword} onChange={(e) => setPassword((current) => ({ ...current, currentPassword: e.target.value }))} />
          <Input label="New Password" required type="password" value={password.newPassword} onChange={(e) => setPassword((current) => ({ ...current, newPassword: e.target.value }))} />
          <Input label="Confirm New Password" required type="password" value={password.confirmPassword} onChange={(e) => setPassword((current) => ({ ...current, confirmPassword: e.target.value }))} />
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5" /> Minimum 8 characters with uppercase, lowercase and a number.</p>
          <Button type="submit" disabled={changingPassword} className="gap-2">{changingPassword && <Loader2 className="h-4 w-4 animate-spin" />} Change Password</Button>
        </form>
      )}
    </div>
  );
}
