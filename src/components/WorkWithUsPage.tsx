import React from 'react';
import { ArrowLeft, Briefcase, Users, Heart, Zap, Shield, Target, Award, Clock } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { WorkWithUsForm } from './WorkWithUsForm';

interface WorkWithUsPageProps {
  onBack: () => void;
}

export function WorkWithUsPage({ onBack }: WorkWithUsPageProps) {
  const { t } = useLanguage();
  const lang = t.language;
  const tr = (pt: string, en: string, es: string) => (lang === 'pt' ? pt : lang === 'en' ? en : es);

  const benefits = [
    { icon: Zap, title: tr('Trabalho Remoto', 'Remote Work', 'Trabajo Remoto'), desc: tr('Trabalhe de onde quiser, com flexibilidade total.', 'Work from anywhere, with total flexibility.', 'Trabaja desde donde quieras, con total flexibilidad.'), color: 'from-blue-500 to-indigo-600' },
    { icon: Award, title: tr('Crescimento Profissional', 'Professional Growth', 'Crecimiento Profesional'), desc: tr('Oportunidades reais de evolução dentro da equipe.', 'Real opportunities for growth within the team.', 'Oportunidades reales de crecimiento dentro del equipo.'), color: 'from-emerald-500 to-teal-600' },
    { icon: Heart, title: tr('Cultura Colaborativa', 'Collaborative Culture', 'Cultura Colaborativa'), desc: tr('Um time que valoriza respeito e parceria.', 'A team that values respect and partnership.', 'Un equipo que valora el respeto y la colaboración.'), color: 'from-rose-500 to-pink-600' },
    { icon: Shield, title: tr('Estabilidade', 'Stability', 'Estabilidad'), desc: tr('Pagamentos pontuais e ambiente seguro.', 'On-time payments and a secure environment.', 'Pagos puntuales y un entorno seguro.'), color: 'from-amber-500 to-orange-600' },
  ];

  const openPositions = [
    tr('Atendente de Suporte', 'Support Agent', 'Agente de Soporte'),
    tr('Gerente de Vendedores', 'Seller Manager', 'Gerente de Vendedores'),
    tr('Moderador de Comunidade', 'Community Moderator', 'Moderador de Comunidad'),
    tr('Desenvolvedor', 'Developer', 'Desarrollador'),
    tr('Marketing', 'Marketing', 'Marketing'),
    tr('Designer', 'Designer', 'Diseñador'),
  ];

  return (
    <div className="w-full mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" />{tr('Voltar', 'Back', 'Volver')}
      </button>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-6 sm:p-10 shadow-xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500 rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {tr('Trabalhe Conosco', 'Work With Us', 'Trabaja con Nosotros')}
              </h1>
            </div>
            <p className="text-sm sm:text-base text-blue-100 leading-relaxed max-w-2xl">
              {tr(
                'Faça parte de uma equipe dinâmica e inovadora. Buscamos pessoas apaixonadas por tecnologia e atendimento para crescerem conosco.',
                'Join a dynamic and innovative team. We look for people passionate about technology and customer service to grow with us.',
                'Únete a un equipo dinámico e innovador. Buscamos personas apasionadas por la tecnología y la atención al cliente para crecer con nosotros.'
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {benefits.map((benefit, i) => {
          const Icon = benefit.icon;
          return (
            <div key={i} className="group bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${benefit.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">{benefit.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{benefit.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {tr('Vagas Abertas', 'Open Positions', 'Puestos Abiertos')}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {openPositions.map((pos, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
              <Users className="h-3.5 w-3.5" />
              {pos}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 border border-gray-700 shadow-xl">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="h-5 w-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-white">
            {tr('Candidate-se Agora', 'Apply Now', 'Postúlate Ahora')}
          </h3>
        </div>
        <WorkWithUsForm />
      </div>
    </div>
  );
}
