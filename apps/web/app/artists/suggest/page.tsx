import ArtistSuggestionForm from './ArtistSuggestionForm';

export const dynamic = 'force-dynamic';

export default function SuggestArtistPage() {
  return (
    <main className="container container--reading">
      <header className="page-head">
        <h1>Suggest a drill artist</h1>
        <p className="muted">
          Share a public YouTube channel. We verify it through YouTube’s official API and review whether it
          belongs in the Kenyan drill catalogue. A channel suggestion does not automatically publish its
          uploads.
        </p>
      </header>
      <ArtistSuggestionForm />
    </main>
  );
}
