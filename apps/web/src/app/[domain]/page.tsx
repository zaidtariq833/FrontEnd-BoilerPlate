export default function Page({ params }: { params: { domain: string } }) {
  return <div>Domain Page of {params.domain}</div>;
}
