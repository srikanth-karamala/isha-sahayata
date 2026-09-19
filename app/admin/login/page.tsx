import LoginForm from './LoginForm';

export default function AdminLoginPage() {
  return (
    <main
      className="min-h-dvh flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(245,183,0,0.14) 0%, transparent 55%), linear-gradient(165deg, #2a2620 0%, #161310 50%, #0c0b09 100%)',
      }}
    >
      <LoginForm />
    </main>
  );
}
