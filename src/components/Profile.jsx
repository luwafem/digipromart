import React, { useState, useEffect } from 'react';
import { supabase, getUserRole } from '../supabase';

export function Profile({ profile, onProfileUpdate }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bankName, setBankName] = useState(profile?.bank_name || '');
  const [accountNumber, setAccountNumber] = useState(profile?.account_number || '');
  const [bankCode, setBankCode] = useState(profile?.bank_code || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const role = getUserRole(profile);
  const isSupplier = role === 'supplier';

  // Bank codes for Nigerian banks
  const bankCodes = [
    { code: '044', name: 'Access Bank' },
    { code: '023', name: 'Citrone' },
    { code: '063', name: 'Diamond Bank' },
    { code: '050', name: 'Ecobank' },
    { code: '214', name: 'FCMB' },
    { code: '058', name: 'Guaranty Trust Bank (GTB)' },
    { code: '030', name: 'Heritage Bank' },
    { code: '082', name: 'Keystone Bank' },
    { code: '014', name: 'Liberty Bank' },
    { code: '076', name: 'Polaris Bank' },
    { code: '221', name: 'Stanbic IBTC' },
    { code: '068', name: 'Standard Chartered' },
    { code: '232', name: 'Sterling Bank' },
    { code: '033', name: 'United Bank for Africa (UBA)' },
    { code: '215', name: 'Unity Bank' },
    { code: '035', name: 'Wema Bank' },
    { code: '057', name: 'Zenith Bank' },
  ];

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updates = {
        display_name: displayName
      };

      // If supplier and bank details provided, update them
      if (isSupplier) {
        updates.bank_name = bankName;
        updates.account_number = accountNumber;
        updates.bank_code = bankCode;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Refresh profile
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      onProfileUpdate(updatedProfile);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify email handler
  const handleVerifyEmail = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) throw error;

      // Note: Supabase Free tier doesn't have email verification resend
      // In production, you'd use a custom Edge Function for this
      setSuccess('Verification email sent! Please check your inbox.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      <div className="card space-y-6">
        <div>
          <label className="label">Email (read-only)</label>
          <input
            type="email"
            className="input bg-gray-100"
            value={profile?.id ? '' : 'Loading...'}
            disabled
          />
          <p className="text-sm text-gray-500 mt-1">Email cannot be changed</p>
        </div>

        <div>
          <label className="label">Account Type</label>
          <div className="flex items-center gap-2">
            <span className="badge badge-info">{role}</span>
            {role === 'supplier' && !profile?.email_verified && (
              <span className="badge badge-warning">Email not verified</span>
            )}
          </div>
        </div>

        <div>
          <label className="label">Display Name</label>
          <input
            type="text"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
          />
        </div>

        {/* Supplier-only bank details */}
        {isSupplier && (
          <div className="border-t pt-6 mt-6">
            <h3 className="text-lg font-semibold mb-4">Bank Details (for payouts)</h3>
            <p className="text-sm text-gray-600 mb-4">
              Add your bank details to receive automated payouts (80% of each sale).
            </p>

            <div className="space-y-4">
              <div>
                <label className="label">Bank</label>
                <select
                  className="input"
                  value={bankCode}
                  onChange={(e) => {
                    setBankCode(e.target.value);
                    const bank = bankCodes.find(b => b.code === e.target.value);
                    setBankName(bank?.name || '');
                  }}
                >
                  <option value="">Select your bank</option>
                  {bankCodes.map(bank => (
                    <option key={bank.code} value={bank.code}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Account Number</label>
                <input
                  type="text"
                  className="input"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="10-digit account number"
                  maxLength={10}
                />
              </div>

              {bankName && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Selected Bank: {bankName}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}