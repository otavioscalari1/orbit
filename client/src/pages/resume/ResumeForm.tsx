import {
  LANGUAGE_LEVELS,
  MAX_ITEMS,
  MAX_LENGTH,
  STATES,
  type ResumeContact,
  type ResumeContent,
} from '../../lib/resume'
import { PhotoField } from './PhotoField'
import {
  AchievementsInput,
  EntryList,
  MonthField,
  ResumeSection,
  SelectField,
  SkillsInput,
  TextAreaField,
  TextField,
} from './ResumeFields'

// Anos à frente na previsão de conclusão do curso
const EDUCATION_FUTURE_YEARS = 10

type ResumeFormProps = {
  content: ResumeContent
  onChange: (content: ResumeContent) => void
  photoUrl: string | null
  onPhotoChange: (hasPhoto: boolean) => void
}

// Todas as seções do currículo. Quem guarda e salva os dados é a ResumePage.
export function ResumeForm({ content, onChange, photoUrl, onPhotoChange }: ResumeFormProps) {
  const { contact } = content

  function updateContact(patch: Partial<ResumeContact>) {
    onChange({ ...content, contact: { ...contact, ...patch } })
  }

  return (
    <div className="min-w-0 space-y-6">
      <ResumeSection id="contact" title="Contato">
        <PhotoField photoUrl={photoUrl} onChange={onPhotoChange} />
        <TextField
          label="Nome completo"
          value={contact.fullName}
          maxLength={MAX_LENGTH.fullName}
          onChange={(fullName) => updateContact({ fullName })}
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <TextField
            label="Cidade"
            value={contact.city}
            maxLength={MAX_LENGTH.city}
            onChange={(city) => updateContact({ city })}
          />
          <SelectField label="Estado" value={contact.state} options={STATES} onChange={(state) => updateContact({ state })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Telefone com DDD"
            value={contact.phone}
            placeholder="(11) 91234-5678"
            maxLength={MAX_LENGTH.phone}
            onChange={(phone) => updateContact({ phone })}
          />
          <TextField
            label="E-mail"
            value={contact.email}
            placeholder="seu.nome@email.com"
            maxLength={MAX_LENGTH.email}
            onChange={(email) => updateContact({ email })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="LinkedIn (opcional)"
            value={contact.linkedin}
            placeholder="linkedin.com/in/seu-nome"
            maxLength={MAX_LENGTH.link}
            onChange={(linkedin) => updateContact({ linkedin })}
          />
          <TextField
            label="GitHub ou portfólio (opcional)"
            value={contact.portfolio}
            placeholder="github.com/seu-nome"
            maxLength={MAX_LENGTH.link}
            onChange={(portfolio) => updateContact({ portfolio })}
          />
        </div>
      </ResumeSection>

      <ResumeSection id="objective" title="Objetivo" hint="A vaga ou área que você busca. Ajuste para cada candidatura.">
        <TextField
          label="Objetivo"
          value={content.objective}
          placeholder="Ex.: Estágio em Desenvolvimento de Software"
          maxLength={MAX_LENGTH.objective}
          onChange={(objective) => onChange({ ...content, objective })}
        />
      </ResumeSection>

      <ResumeSection id="summary" title="Resumo" hint="De 2 a 4 linhas sobre quem você é, o que sabe fazer e o que busca.">
        <TextAreaField
          label="Resumo"
          value={content.summary}
          rows={4}
          placeholder="Ex.: Estudante de Engenharia de Software no 5º semestre, com projetos em React e Node. Busco estágio para aplicar o que aprendi e crescer em desenvolvimento web."
          maxLength={MAX_LENGTH.summary}
          onChange={(summary) => onChange({ ...content, summary })}
        />
      </ResumeSection>

      <ResumeSection id="education" title="Formação" hint="Pelo menos 1. Se ainda estiver cursando, informe a previsão de conclusão.">
        <EntryList
          items={content.education}
          max={MAX_ITEMS.education}
          addLabel="Adicionar formação"
          createItem={() => ({
            id: crypto.randomUUID(),
            course: '',
            institution: '',
            semester: '',
            startDate: '',
            endDate: '',
          })}
          onChange={(education) => onChange({ ...content, education })}
          renderItem={(item, update) => (
            <>
              <TextField
                label="Curso"
                value={item.course}
                placeholder="Ex.: Bacharelado em Ciência da Computação"
                maxLength={MAX_LENGTH.title}
                onChange={(course) => update({ course })}
              />
              <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
                <TextField
                  label="Instituição"
                  value={item.institution}
                  maxLength={MAX_LENGTH.title}
                  onChange={(institution) => update({ institution })}
                />
                <TextField
                  label="Semestre atual (opcional)"
                  value={item.semester}
                  placeholder="Ex.: 5º semestre"
                  maxLength={MAX_LENGTH.semester}
                  onChange={(semester) => update({ semester })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <MonthField label="Início" value={item.startDate} onChange={(startDate) => update({ startDate })} />
                <MonthField
                  label="Conclusão ou previsão"
                  value={item.endDate}
                  futureYears={EDUCATION_FUTURE_YEARS}
                  onChange={(endDate) => update({ endDate })}
                />
              </div>
            </>
          )}
        />
      </ResumeSection>

      <ResumeSection id="skills" title="Habilidades" hint="Pelo menos 3. Ferramentas e conhecimentos técnicos que você realmente usa.">
        <SkillsInput skills={content.skills} onChange={(skills) => onChange({ ...content, skills })} />
      </ResumeSection>

      <ResumeSection id="languages" title="Idiomas" hint="Pelo menos 1. Pode incluir o português como nativo.">
        <EntryList
          items={content.languages}
          max={MAX_ITEMS.languages}
          addLabel="Adicionar idioma"
          createItem={() => ({ id: crypto.randomUUID(), name: '', level: '' })}
          onChange={(languages) => onChange({ ...content, languages })}
          renderItem={(item, update) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Idioma"
                value={item.name}
                placeholder="Ex.: Inglês"
                maxLength={MAX_LENGTH.language}
                onChange={(name) => update({ name })}
              />
              <SelectField
                label="Nível"
                value={item.level}
                options={LANGUAGE_LEVELS}
                onChange={(level) => update({ level })}
              />
            </div>
          )}
        />
      </ResumeSection>

      <ResumeSection
        id="experience"
        title="Experiência"
        hint="Estágios e empregos. Se ainda não tiver, tudo bem: basta preencher um projeto ou uma atividade."
      >
        <EntryList
          items={content.experience}
          max={MAX_ITEMS.experience}
          addLabel="Adicionar experiência"
          createItem={() => ({
            id: crypto.randomUUID(),
            company: '',
            role: '',
            location: '',
            startDate: '',
            endDate: '',
            current: false,
            achievements: [''],
          })}
          onChange={(experience) => onChange({ ...content, experience })}
          renderItem={(item, update) => (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Cargo"
                  value={item.role}
                  placeholder="Ex.: Estagiário de Dados"
                  maxLength={MAX_LENGTH.title}
                  onChange={(role) => update({ role })}
                />
                <TextField
                  label="Empresa"
                  value={item.company}
                  maxLength={MAX_LENGTH.title}
                  onChange={(company) => update({ company })}
                />
              </div>
              <TextField
                label="Cidade (opcional)"
                value={item.location}
                placeholder="Ex.: São Paulo/SP ou Remoto"
                maxLength={MAX_LENGTH.location}
                onChange={(location) => update({ location })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <MonthField label="Início" value={item.startDate} onChange={(startDate) => update({ startDate })} />
                {!item.current && (
                  <MonthField label="Fim" value={item.endDate} onChange={(endDate) => update({ endDate })} />
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={item.current}
                  onChange={(event) => update({ current: event.target.checked, endDate: '' })}
                  className="h-4 w-4 accent-brand"
                />
                Trabalho aqui atualmente
              </label>
              <AchievementsInput
                achievements={item.achievements}
                onChange={(achievements) => update({ achievements })}
              />
            </>
          )}
        />
      </ResumeSection>

      <ResumeSection id="projects" title="Projetos" hint="Trabalhos da faculdade e projetos pessoais contam, e muito.">
        <EntryList
          items={content.projects}
          max={MAX_ITEMS.projects}
          addLabel="Adicionar projeto"
          createItem={() => ({ id: crypto.randomUUID(), name: '', description: '', technologies: '', link: '' })}
          onChange={(projects) => onChange({ ...content, projects })}
          renderItem={(item, update) => (
            <>
              <TextField
                label="Nome do projeto"
                value={item.name}
                maxLength={MAX_LENGTH.title}
                onChange={(name) => update({ name })}
              />
              <TextAreaField
                label="O que ele faz e qual foi a sua parte"
                value={item.description}
                maxLength={MAX_LENGTH.description}
                onChange={(description) => update({ description })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Tecnologias (opcional)"
                  value={item.technologies}
                  placeholder="Ex.: React, Node, PostgreSQL"
                  maxLength={MAX_LENGTH.technologies}
                  onChange={(technologies) => update({ technologies })}
                />
                <TextField
                  label="Link (opcional)"
                  value={item.link}
                  placeholder="github.com/seu-nome/projeto"
                  maxLength={MAX_LENGTH.link}
                  onChange={(link) => update({ link })}
                />
              </div>
            </>
          )}
        />
      </ResumeSection>

      <ResumeSection id="activities" title="Atividades" hint="Monitoria, iniciação científica, empresa júnior, voluntariado...">
        <EntryList
          items={content.activities}
          max={MAX_ITEMS.activities}
          addLabel="Adicionar atividade"
          createItem={() => ({
            id: crypto.randomUUID(),
            name: '',
            organization: '',
            description: '',
            startDate: '',
            endDate: '',
            current: false,
          })}
          onChange={(activities) => onChange({ ...content, activities })}
          renderItem={(item, update) => (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Atividade"
                  value={item.name}
                  placeholder="Ex.: Monitoria de Cálculo I"
                  maxLength={MAX_LENGTH.title}
                  onChange={(name) => update({ name })}
                />
                <TextField
                  label="Organização (opcional)"
                  value={item.organization}
                  maxLength={MAX_LENGTH.title}
                  onChange={(organization) => update({ organization })}
                />
              </div>
              <TextAreaField
                label="O que você fez"
                value={item.description}
                maxLength={MAX_LENGTH.description}
                onChange={(description) => update({ description })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <MonthField
                  label="Início (opcional)"
                  value={item.startDate}
                  onChange={(startDate) => update({ startDate })}
                />
                {!item.current && (
                  <MonthField label="Fim (opcional)" value={item.endDate} onChange={(endDate) => update({ endDate })} />
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={item.current}
                  onChange={(event) => update({ current: event.target.checked, endDate: '' })}
                  className="h-4 w-4 accent-brand"
                />
                Participo atualmente
              </label>
            </>
          )}
        />
      </ResumeSection>

      <ResumeSection id="courses" title="Cursos e certificações" hint="Opcional. Coloque os que têm relação com a vaga.">
        <EntryList
          items={content.courses}
          max={MAX_ITEMS.courses}
          addLabel="Adicionar curso"
          createItem={() => ({ id: crypto.randomUUID(), name: '', institution: '', year: '' })}
          onChange={(courses) => onChange({ ...content, courses })}
          renderItem={(item, update) => (
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
              <TextField
                label="Nome"
                value={item.name}
                maxLength={MAX_LENGTH.title}
                onChange={(name) => update({ name })}
              />
              <TextField
                label="Instituição"
                value={item.institution}
                maxLength={MAX_LENGTH.title}
                onChange={(institution) => update({ institution })}
              />
              <TextField
                label="Ano (opcional)"
                value={item.year}
                maxLength={4}
                onChange={(year) => update({ year: year.replace(/\D/g, '') })}
              />
            </div>
          )}
        />
      </ResumeSection>
    </div>
  )
}
