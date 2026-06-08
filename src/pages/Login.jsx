import { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, Eye, EyeOff, Hexagon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import loginImage from '../assets/A_avatar.png';
import logoImage from '../assets/logo_core.png';

export default function Login() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Redirigir al panel si ya hay sesión iniciada
  useEffect(() => {
    if (user) {
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

  // Configuración de Formik y Yup para validaciones
  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    validationSchema: Yup.object({
      email: Yup.string()
        .email('El correo electrónico no es válido')
        .required('El correo es obligatorio'),
      password: Yup.string()
        .required('La contraseña es obligatoria')
        .min(6, 'Debe tener al menos 6 caracteres'),
    }),
    onSubmit: async (values, { setSubmitting }) => {
      setAuthError('');

      try {
        // Llamada a Supabase para iniciar sesión
        const { data, error } = await signIn(values.email, values.password);

        if (error) {
          // Manejo de errores básicos de Supabase
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Correo electrónico o contraseña incorrectos.');
          }
          throw error;
        }

        // Aquí más adelante consultaremos la tabla de roles/accesos
        // const { data: profile } = await supabase.from('users').select('*').eq('id', data.user.id).single();

        navigate('/home'); // Redirigir al panel principal

      } catch (error) {
        setAuthError(error.message || 'Ha ocurrido un error al iniciar sesión.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <div className="min-h-screen flex text-gray-900 bg-white">

      {/* Sección Izquierda - Branding e Imagen (Oculta en móviles) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-brand-900 text-white overflow-hidden">
        {/* Imagen de fondo / Textura */}
        <div
          className="absolute inset-0 z-0 opacity-40 bg-cover bg-center"
          style={{ backgroundImage: `url(${loginImage})` }}
        />
        {/* Capa de Gradiente Moderno */}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-brand-900 via-brand-800/80 to-transparent" />

        {/* Contenido Izquierdo */}
        <div className="relative z-20 flex flex-col justify-between p-12 h-full">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white rounded-md shadow-lg backdrop-blur-sm border border-gray-100">
                <img src={logoImage} alt="SERCOSYS CORE" className="h-10 w-auto object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tighter leading-none">SERCOSYS</span>
                <span className="text-xs font-black tracking-[0.3em] text-brand-300 leading-none mt-1">CORE</span>
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl font-semibold mb-6 leading-tight">
              Gestión Inteligente de Comedores Industriales
            </h2>
            <p className="text-brand-200 text-lg mb-8 leading-relaxed">
              Optimice sus inventarios, planifique menús con precisión y mantenga el control total de la asistencia y calidad de servicio en múltiples sitios.
            </p>
            <div className="flex items-center gap-4 text-sm text-brand-300 font-medium">
              <div className="h-px bg-brand-600 flex-1"></div>
              <span>Sistema Centralizado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sección Derecha - Formulario de Login con FORMIK */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 ">
        <div className="w-full max-w-md space-y-8">

          {/* Cabecera Móvil */}
          <div className="flex flex-col items-center lg:hidden mb-8 text-center">
            <div className="p-3 bg-white rounded-xl mb-4 shadow-xl border border-gray-50">
              <img src={logoImage} alt="SERCOSYS CORE" className="h-14 w-auto object-contain" />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black tracking-tighter text-slate-800 leading-none uppercase">SERCOSYS</span>
              <span className="text-[10px] font-black tracking-[0.4em] text-brand-600 leading-none mt-1 uppercase">CORE</span>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Iniciar Sesión</h3>
            <p className="text-gray-500">Introduzca sus credenciales para acceder al sistema.</p>
          </div>

          {/* Alerta de Error General si falla la autenticación en Supabase */}
          {authError && (
            <div className="p-4 rounded-md bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
              <p className="text-sm text-red-700 font-medium">{authError}</p>
            </div>
          )}

          <form onSubmit={formik.handleSubmit} className="space-y-6 mt-8">
            <div className="space-y-5">

              {/* Campo Correo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Mail size={18} className={formik.touched.email && formik.errors.email ? "text-red-400" : ""} />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.email}
                    className={`block w-full pl-10 pr-3 py-2.5 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors sm:text-sm shadow-sm
                      ${formik.touched.email && formik.errors.email ? 'border-red-300 ring-red-100 bg-red-50/30' : 'border-gray-300'}
                    `}
                    placeholder="admin@empresa.com"
                  />
                </div>
                {formik.touched.email && formik.errors.email ? (
                  <p className="mt-1.5 text-sm text-red-500">{formik.errors.email}</p>
                ) : null}
              </div>

              {/* Campo Contraseña */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} className={formik.touched.password && formik.errors.password ? "text-red-400" : ""} />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.password}
                    className={`block w-full pl-10 pr-10 py-2.5 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors sm:text-sm shadow-sm
                      ${formik.touched.password && formik.errors.password ? 'border-red-300 ring-red-100 bg-red-50/30' : 'border-gray-300'}
                    `}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-brand-accent transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formik.touched.password && formik.errors.password ? (
                  <p className="mt-1.5 text-sm text-red-500">{formik.errors.password}</p>
                ) : null}
              </div>
            </div>

            <button
              type="submit"
              disabled={formik.isSubmitting}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-900 hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-900 transition-colors disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {formik.isSubmitting ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  Entrar al Panel
                  <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Desarrollado para la Corporación Sercoinfal C.A. ©2026
          </p>
        </div>
      </div>
    </div>
  );
}
