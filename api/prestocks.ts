export async function GET() {
  const response = await fetch('https://prestocks.com/api/prestocks', {
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    return new Response(
      JSON.stringify({
        error: `PreStocks upstream returned ${response.status}`,
      }),
      {
        status: 502,
        headers: {
          'content-type': 'application/json',
        },
      },
    )
  }

  const data = await response.text()

  return new Response(data, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 's-maxage=30, stale-while-revalidate=120',
    },
  })
}
