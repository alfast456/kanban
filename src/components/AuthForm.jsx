export function AuthForm({ mode, onModeChange, onSubmit, onGoogleLogin, onCancel, error }) {
  const isLogin = mode === 'login';

  return (
    <>
      <h3>{isLogin ? 'Masuk ke Kanban' : 'Buat Akun'}</h3>
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="auth-username">Username</label>
          <input
            id="auth-username"
            name="username"
            autoFocus
            autoComplete="username"
            minLength="3"
            maxLength="30"
            pattern="[A-Za-z0-9_]+"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength="6"
            required
          />
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>Batal</button>
          <button type="submit" className="save-btn">{isLogin ? 'Masuk' : 'Daftar'}</button>
        </div>
      </form>
      <div className="auth-divider">atau</div>
      <button type="button" className="google-auth-btn" onClick={onGoogleLogin}>Lanjutkan dengan Google</button>
      <button type="button" className="auth-switch" onClick={() => onModeChange(isLogin ? 'register' : 'login')}>
        {isLogin ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
      </button>
    </>
  );
}
