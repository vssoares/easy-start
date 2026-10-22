export interface AppSection {
  route: string;
  label: string;
  description: string;
  /** Dica curta mostrada na Ajuda. */
  tip: string;
}

/** Descrição de cada área do app, usada na página Início e na Ajuda. */
export const SECTIONS: AppSection[] = [
  {
    route: '/biblioteca',
    label: 'Biblioteca',
    description: 'Instala vários programas de uma vez.',
    tip: 'Marque os programas e instale tudo em sequência, ideal depois de formatar o PC.',
  },
  {
    route: '/acesso-rapido',
    label: 'Acesso rápido',
    description: 'Portas, pastas e utilitários do Windows.',
    tip: 'Liberou a porta 4200 que ficou presa por um servidor de desenvolvimento? Use "Encerrar porta".',
  },
  {
    route: '/monitores',
    label: 'Monitores',
    description: 'Ativa, desativa e define o monitor principal.',
    tip: 'Mantém sempre ao menos um monitor ativo para você não ficar sem tela.',
  },
  {
    route: '/sistema',
    label: 'Meu PC',
    description: 'Hardware, drivers e armazenamento.',
    tip: 'Mostra se o driver da placa de vídeo está desatualizado e baixa o instalador oficial.',
  },
  {
    route: '/node',
    label: 'Node',
    description: 'Gerencia as versões do Node.js.',
    tip: 'Instala, troca e remove versões sem abrir o terminal.',
  },
  {
    route: '/sensores',
    label: 'Sensores',
    description: 'Uso, temperatura e detector de gargalo.',
    tip: 'Deixe aberto enquanto joga em outra tela: o veredito mostra se CPU, GPU, VRAM ou RAM limita o desempenho.',
  },
  {
    route: '/rede',
    label: 'Rede',
    description: 'Latência, perda, DNS e velocidade.',
    tip: 'Roteador com latência alta indica Wi-Fi ruim; roteador bom e internet alta indica problema do provedor.',
  },
  {
    route: '/otimizacao',
    label: 'Otimização',
    description: 'Libera memória e ajusta o Windows para jogos.',
    tip: 'Use antes de abrir um jogo. Todo ajuste guarda o valor original e pode ser desfeito.',
  },
  {
    route: '/inicializacao',
    label: 'Inicialização',
    description: 'Programas que abrem com o Windows.',
    tip: 'Desativar mantém o item na lista para religar depois; remover guarda uma cópia para restaurar.',
  },
  {
    route: '/maker',
    label: 'Maker',
    description: 'Arduino, ESP e conversores seriais.',
    tip: 'Placa não aparece na IDE? Veja o diagnóstico em "Placas conectadas" e libere números de COM presos.',
  },
];

export interface HelpQuestion {
  question: string;
  answer: string;
}

export const FAQ: HelpQuestion[] = [
  {
    question: 'Por que algumas ações pedem administrador?',
    answer:
      'Mexer em configurações da máquina inteira (HKLM), remover drivers e dispositivos e esvaziar a lista de espera da RAM exigem permissão elevada. Feche o app e abra com "Executar como administrador".',
  },
  {
    question: 'Os ajustes do Windows podem ser desfeitos?',
    answer:
      'Sim. O valor original de cada ajuste é guardado na primeira alteração. Em Otimização, "Restaurar originais" volta tudo ao que era.',
  },
  {
    question: 'Por que a temperatura da CPU aparece como indisponível?',
    answer:
      'O Windows só expõe esse sensor se a placa-mãe publicar a zona térmica ACPI, o que muitas não fazem. Nesse caso o valor fica indisponível em vez de inventado.',
  },
  {
    question: 'Os detalhes da GPU aparecem só para NVIDIA?',
    answer:
      'Sim. Temperatura, clocks, consumo e PCIe vêm do nvidia-smi, que acompanha o driver da NVIDIA. Em outras placas aparecem apenas uso e memória de vídeo em uso.',
  },
  {
    question: 'O teste de velocidade grava algo no disco?',
    answer: 'Não. Ele usa o servidor público speed.cloudflare.com e descarta os dados na hora.',
  },
];
