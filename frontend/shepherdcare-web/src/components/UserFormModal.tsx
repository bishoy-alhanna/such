import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { mapValidationErrors } from '../utils/validation'
import type { Role, UserDto } from '../types'
import { useT } from '../i18n'

interface Props {
  user?: UserDto | null          // null = create mode, set = edit mode
  onSaved: (u: UserDto) => void
  onCancel: () => void
}

export default function UserFormModal({ user, onSaved, onCancel }: Props) {
  const { t } = useT()
  const isEdit = !!user

  const [username, setUsername]       = useState(user?.username ?? '')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [password, setPassword]       = useState('')
  const [roleId, setRoleId]           = useState(user?.roleId ?? '')
  const [email, setEmail]             = useState(user?.email ?? '')
  const [roles, setRoles]             = useState<Role[]>([])
  const [errors, setErrors]           = useState<Record<string, string[]>>({})
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    api.get<Role[]>('/roles').then(r => setRoles(r.data)).catch(() => {})
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      if (isEdit) {
        await api.put(`/users/${user!.id}`, { username, displayName, password, roleId, email })
        onSaved({ ...user!, username, displayName, roleId, email: email || undefined })
      } else {
        const res = await api.post<UserDto>('/users', { username, displayName, password, roleId, email })
        onSaved(res.data)
      }
    } catch (err: unknown) {
      setErrors(mapValidationErrors(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{isEdit ? `${t('common.edit')} — ${user!.username}` : t('users.userForm.createUser')}</h3>
        <form onSubmit={submit}>
          <label>{t('users.userForm.username')}</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder={t('users.userForm.username')}
            disabled={isEdit}   /* username is immutable on edit */
          />
          {errors.Username && <div className="error">{errors.Username.join(', ')}</div>}

          <label>{t('users.userForm.displayName')}</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={t('users.userForm.displayName')}
          />

          <label>{isEdit ? t('users.userForm.passwordHint') : t('users.userForm.password')}</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={isEdit ? t('users.userForm.passwordHint') : t('users.userForm.password')}
          />
          {errors.Password && <div className="error">{errors.Password.join(', ')}</div>}

          <label>البريد الإلكتروني (للتقارير الأسبوعية)</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="example@church.org"
          />

          <label>{t('users.userForm.role')}</label>
          <select value={roleId} onChange={e => setRoleId(e.target.value)}>
            <option value="">{t('users.userForm.selectRole')}</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {errors.RoleId && <div className="error">{errors.RoleId.join(', ')}</div>}

          <div className="modal-actions">
            <button type="submit" disabled={saving}>{saving ? t('common.saving') : isEdit ? t('common.save') : t('users.userForm.createUser')}</button>
            <button type="button" onClick={onCancel} disabled={saving}>{t('common.cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
