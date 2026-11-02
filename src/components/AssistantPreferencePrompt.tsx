import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { assistantOutline } from './AssistantProductOptions';

export interface AssistantPreference {
  id: number;
  stage: 'volume' | 'brand';
  choices: Array<{ value: string; label: string }>;
}

interface Props {
  preference: AssistantPreference;
  disabled: boolean;
  onChoose: (value: string, label: string) => void;
}

export default function AssistantPreferencePrompt({ preference, disabled, onChoose }: Props) {
  return (
    <div className="mt-3 flex flex-col items-start gap-2">
      <Select disabled={disabled} onValueChange={value => onChoose(value, preference.choices.find(choice => choice.value === value)!.label)}>
        <SelectTrigger className="w-full border-slate-200 bg-white text-slate-800" aria-label={preference.stage === 'volume' ? 'Escolher volume em ml' : 'Escolher marca'}>
          <SelectValue placeholder={preference.stage === 'volume' ? 'Escolha o volume em ml' : 'Escolha a marca'} />
        </SelectTrigger>
        <SelectContent className="z-[1000001] max-h-60 border-slate-200 bg-white text-slate-800">
          {preference.choices.map(choice => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button disabled={disabled} size="sm" variant="outline" className={assistantOutline} onClick={() => onChoose('any', 'Sem preferência')}>Sem preferência</Button>
    </div>
  );
}
