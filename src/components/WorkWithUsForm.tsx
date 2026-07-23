import React, { useState } from 'react';
import { Send, Loader, Check, AlertCircle, Briefcase, Mail, User, Phone, Globe, Clock, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

export function WorkWithUsForm() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const lang = t.language;
  const tr = (pt: string, en: string, es: string) => (lang === 'pt' ? pt : lang === 'en' ? en : es);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    desired_position: '',
    experience: '',
    availability: '',
    portfolio_url: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const positions = [
    tr('Atendente de Suporte', 'Support Agent', 'Agente de Soporte'),
    tr('Gerente de Vendedores', 'Seller Manager', 'Gerente de Vendedores'),
    tr('Moderador de Comunidade', 'Community Moderator', 'Moderador de Comunidad'),
    tr('Desenvolvedor', 'Developer', 'Desarrollador'),
    tr('Marketing', 'Marketing', 'Marketing'),
    tr('Designer', 'Designer', 'Diseñador'),
    tr('Outro', 'Other', 'Otro'),
  ];

  const availabilities = [
    tr('Tempo Integral', 'Full-time', 'Tiempo Completo'),
    tr('Meio Período', 'Part-time', 'Medio Tiempo'),
    tr('Freelance', 'Freelance', 'Freelance'),
    tr('Estágio', 'Internship', 'Pasantía'),
  ];

  React.useEffect(() => {
    if (user) {
      supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setFormData(prev => ({
              ...prev,
              full_name: data.full_name || '',
              email: user.email || '',
            }));
          }
        });
    }
  }, [user]);

  function handleChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!formData.full_name.trim() || !formData.email.trim() || !formData.desired_position.trim() || !formData.message.trim()) {
      setError(tr('Preencha todos os campos obrigatórios', 'Fill in all required fields', 'Completa todos los campos obligatorios'));
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from('team_applications').insert({
        user_id: user?.id || null,
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        desired_position: formData.desired_position,
        experience: formData.experience.trim() || null,
        availability: formData.availability || null,
        portfolio_url: formData.portfolio_url.trim() || null,
        message: formData.message.trim(),
      });
      if (insertError) throw insertError;
      setSuccess(true);
    } catch {
      setError(tr('Erro ao enviar candidatura. Tente novamente.', 'Error submitting application. Try again.', 'Error al enviar la solicitud. Inténtalo de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-100 mb-2">
          {tr('Candidatura Enviada!', 'Application Sent!', '¡Solicitud Enviada!')}
        </h3>
        <p className="text-sm text-gray-300 max-w-sm">
          {tr(
            'Recebemos sua candidatura e entraremos em contato em breve. Obrigado pelo interesse em fazer parte da nossa equipe!',
            'We received your application and will contact you soon. Thank you for your interest in joining our team!',
            '¡Recibimos tu solicitud y nos pondremos en contacto contigo pronto. ¡Gracias por tu interés en unirte a nuestro equipo!'
          )}
        </p>
      </div>
    );
  }

  const inputClass = "w-full rounded-xl border border-gray-600 bg-gray-800/50 px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-400 transition-colors";
  const labelClass = "block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-xl p-3">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{tr('Nome Completo *', 'Full Name *', 'Nombre Completo *')}</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input type="text" value={formData.full_name} onChange={e => handleChange('full_name', e.target.value)}
              className={`${inputClass} pl-9`} placeholder={tr('Seu nome', 'Your name', 'Tu nombre')} />
          </div>
        </div>
        <div>
          <label className={labelClass}>{tr('E-mail *', 'Email *', 'Correo *')}</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)}
              className={`${inputClass} pl-9`} placeholder="email@exemplo.com" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{tr('Telefone', 'Phone', 'Teléfono')}</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input type="tel" value={formData.phone} onChange={e => handleChange('phone', e.target.value)}
              className={`${inputClass} pl-9`} placeholder="(00) 00000-0000" />
          </div>
        </div>
        <div>
          <label className={labelClass}>{tr('Vaga Desejada *', 'Desired Position *', 'Puesto Deseado *')}</label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 z-10" />
            <select value={formData.desired_position} onChange={e => handleChange('desired_position', e.target.value)}
              className={`${inputClass} pl-9 appearance-none cursor-pointer`}>
              <option value="">{tr('Selecione...', 'Select...', 'Selecciona...')}</option>
              {positions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{tr('Disponibilidade', 'Availability', 'Disponibilidad')}</label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 z-10" />
            <select value={formData.availability} onChange={e => handleChange('availability', e.target.value)}
              className={`${inputClass} pl-9 appearance-none cursor-pointer`}>
              <option value="">{tr('Selecione...', 'Select...', 'Selecciona...')}</option>
              {availabilities.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>{tr('Portfolio / LinkedIn', 'Portfolio / LinkedIn', 'Portfolio / LinkedIn')}</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input type="url" value={formData.portfolio_url} onChange={e => handleChange('portfolio_url', e.target.value)}
              className={`${inputClass} pl-9`} placeholder="https://..." />
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>{tr('Experiência e Habilidades', 'Experience & Skills', 'Experiencia y Habilidades')}</label>
        <textarea value={formData.experience} onChange={e => handleChange('experience', e.target.value)}
          rows={3} className={`${inputClass} resize-none`}
          placeholder={tr('Conte sobre sua experiência relevante...', 'Tell us about your relevant experience...', 'Cuéntanos sobre tu experiencia relevante...')} />
      </div>

      <div>
        <label className={labelClass}>{tr('Mensagem *', 'Message *', 'Mensaje *')}</label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
          <textarea value={formData.message} onChange={e => handleChange('message', e.target.value)}
            rows={4} className={`${inputClass} pl-9 pt-2.5 resize-none`}
            placeholder={tr('Por que você querer fazer parte da equipe?', 'Why do you want to join the team?', '¿Por qué quieres unirte al equipo?')} />
        </div>
      </div>

      <button type="submit" disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg disabled:opacity-60">
        {submitting ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {tr('Enviar Candidatura', 'Submit Application', 'Enviar Solicitud')}
      </button>
    </form>
  );
}
