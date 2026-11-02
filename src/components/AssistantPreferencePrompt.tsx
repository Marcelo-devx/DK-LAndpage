import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { assistantOutline } from './AssistantProductOptions';

export interface AssistantPreference {
  id: number;
  stage: 'type' | 'volume' | 'brand';
  choices: Array<{ value: string; label: string }>;
}

interface Props {
  preference: AssistantPreference;
  disabled: boolean;
  onChoose: (value: string, label: string) => void;
}

export default function AssistantPreferencePrompt({ preference, disabled, onChoose }: Props) {
  if (preference.stage === 'type') {
    return <div className="mt-3 flex flex-wrap gap-2">
      {preference.choices.map(choice => <Button key={choice.value} disabled={disabled} size="sm" variant="outline" className={assistantOutline} onClick={() => onChoose(choice.value, choice.label)}>{choice.label}</Button>)}
    </div>;
  }

  const volume = preference.stage === 'volume';
  const skipLabel = volume ? 'Qualquer volume' : 'Qualquer marca';
  return (
    <div className="mt-3 flex flex-col items-start gap-2">
      <Select disabled={disabled} onValueChange={value => onChoose(value, preference.choices.find(choice => choice.value === value)!.label)}>
        <SelectTrigger className="w-full border-slate-200 bg-white text-slate-800" aria-label={volume ? 'Escolher volume em ml' : 'Escolher marca'}>
          <SelectValue placeholder={volume ? 'Qual volume você prefere?' : 'Qual marca você prefere?'} />
        </SelectTrigger>
        <SelectContent className="z-[1000001] max-h-60 border-slate-200 bg-white text-slate-800">
          {preference.choices.map(choice => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button disabled={disabled} size="sm" variant="outline" className={assistantOutline} onClick={() => onChoose('any', skipLabel)}>{skipLabel}</Button>
      <p className="text-xs text-slate-500">{volume ? 'Pula só o volume, mantendo o tipo de produto escolhido.' : 'Pula só a marca, mantendo suas escolhas anteriores.'}</p>
    </div>
  );
}
