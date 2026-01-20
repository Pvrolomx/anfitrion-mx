export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  try {
    // Token desde env var (seguro)
    const token = process.env.BANXICO_TOKEN;
    
    if (!token) {
      throw new Error('BANXICO_TOKEN no configurado');
    }
    
    // Banxico API - Serie SF43718 (Fix USD)
    const url = 'https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/oportuno';
    
    const response = await fetch(url, {
      headers: {
        'Bmx-Token': token,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Banxico API error: ' + response.status);
    }
    
    const data = await response.json();
    const serie = data.bmx?.series?.[0];
    const dato = serie?.datos?.[0];
    
    if (dato?.dato) {
      const tipoCambio = parseFloat(dato.dato);
      return res.status(200).json({
        tipoCambio,
        fecha: dato.fecha,
        fuente: 'Banxico',
        serie: 'SF43718'
      });
    }
    
    throw new Error('No data from Banxico');
    
  } catch (error) {
    // Fallback
    return res.status(200).json({
      tipoCambio: 20.50,
      fecha: new Date().toISOString().split('T')[0],
      fuente: 'Fallback',
      error: error.message
    });
  }
}
