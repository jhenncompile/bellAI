// Las cinco pestañas principales. Las pantallas secundarias (outfits, estilo, simulador…) viven fuera
// de este grupo, en el Stack raíz: en Expo Router 58 una pestaña oculta (`href: null`) redirige a la
// primera pestaña y no se puede abrir con router.push.
export { default } from '@/views/AppTabs';
