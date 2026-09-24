import { useState, useEffect } from 'react';

export function TestComponent() {
  const [data, setData] = useState(null);

  const loadData = async () => {
    const res = await fetch('/api');
    setData(await res.json());
  };

  useEffect(() => {
    async function init() {
      await loadData();
    }
    init();
  }, []);

  return <div>{data}</div>;
}
