/** Copy for the 404 page. Pure for tests. The requested path is shown shortened and only when it is plain text. */
export function notFoundCopy(pathname: string | null | undefined) {
  const raw = (pathname ?? '').split(/[?#]/)[0];
  const path = /^\/[\w./@~%-]{1,80}$/.test(raw) && raw !== '/' ? raw : '';
  const addHint = /^\/(add|friend|u)\b/i.test(raw);
  return {
    title: 'Oeps, deze pagina bestaat niet',
    body: addHint
      ? 'Deze vriendenlink klopt niet (meer). Vraag je vriend om de link opnieuw te delen, of zoek op gebruikersnaam.'
      : 'De link is misschien verlopen of verkeerd getypt. Geen zorgen: je snaps en chats staan gewoon nog klaar.',
    path,
    addHint,
  };
}
