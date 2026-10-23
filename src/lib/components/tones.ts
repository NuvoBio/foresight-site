export function severityTone(sev: string): 'green' | 'orange' | 'orange-solid' | 'neutral' {
	return sev === 'mild_moderate' ? 'green' : sev === 'severe' ? 'orange' : sev === 'fatal' ? 'orange-solid' : 'neutral';
}

export function strengthTone(s: string | null): 'green' | 'orange' | 'neutral' {
	return s === 'strong' ? 'green' : s === 'moderate' ? 'neutral' : s === 'weak' ? 'orange' : 'neutral';
}
