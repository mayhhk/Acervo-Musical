/* =========================================================
   Utilidades
   ========================================================= */

// Imagem mostrada quando um arquivo não é encontrado
const IMAGEM_RESERVA =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">' +
    '<rect width="100%" height="100%" fill="#8a3a44"/>' +
    '<text x="50%" y="50%" fill="#F8E5D7" font-family="sans-serif" font-size="20" ' +
    'text-anchor="middle">Imagem indisponível</text></svg>'
  );

document.addEventListener(
  "error",
  (e) => {
    if (e.target.tagName === "IMG" && !e.target.dataset.reserva) {
      e.target.dataset.reserva = "1";
      e.target.src = IMAGEM_RESERVA;
    }
  },
  true
);

// Remove acentos e maiúsculas para a busca ("tabua" encontra "Tábua")
function normalizar(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

async function carregarDados() {
  const resposta = await fetch("dados.json");
  if (!resposta.ok) throw new Error("Não foi possível carregar dados.json");
  return resposta.json();
}

/* =========================================================
   Busca (cabeçalho, presente nas duas páginas)
   ========================================================= */
function configurarBusca(aoBuscar) {
  const campo = document.getElementById("pesquisaInput");
  const botao = document.getElementById("pesquisaBtn");
  if (!campo || !botao) return;

  const buscar = () => aoBuscar(campo.value.trim());
  botao.addEventListener("click", buscar);
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") buscar();
  });
  campo.addEventListener("input", () => {
    if (campo.value === "") buscar(); // campo limpo volta a mostrar tudo
  });
}

/* =========================================================
   Tela 1: index.html
   ========================================================= */
async function iniciarHome() {
  const grade = document.getElementById("lista-artistas");
  if (!grade) return; // não estamos na index

  let artistas;
  try {
    artistas = await carregarDados();
  } catch (erro) {
    grade.innerHTML =
      '<p class="mensagem">Não foi possível carregar os artistas. Abra o site por um servidor local (Live Server).</p>';
    console.error(erro);
    return;
  }

  function desenharGrade(termo = "") {
    const t = normalizar(termo);
    const filtrados = artistas.filter(
      (a) =>
        normalizar(a.nome).includes(t) ||
        a.albuns.some((al) => normalizar(al.titulo).includes(t))
    );

    grade.innerHTML =
      filtrados.length === 0
        ? '<p class="mensagem">Nenhum artista ou álbum encontrado para essa busca.</p>'
        : filtrados
            .map(
              (a) => `
        <a class="card" href="detalhe.html?id=${a.id}">
          <img src="${a.imagem}" alt="${a.nome}" loading="lazy">
          <div class="card-corpo">
            <h3>${a.nome}</h3>
            <p>${a.resumo}</p>
          </div>
        </a>`
            )
            .join("");
  }

  desenharGrade();
  iniciarCarrossel(artistas.filter((a) => a.destaque));

  configurarBusca((termo) => {
    desenharGrade(termo);
    if (termo) document.getElementById("artistas").scrollIntoView();
  });

  // Veio de outra página com ?busca=...
  const buscaInicial = new URLSearchParams(window.location.search).get("busca");
  if (buscaInicial) {
    document.getElementById("pesquisaInput").value = buscaInicial;
    desenharGrade(buscaInicial);
    document.getElementById("artistas").scrollIntoView();
  }
}

function iniciarCarrossel(destaques) {
  const carrossel = document.getElementById("carrossel");
  const trilho = document.getElementById("carrossel-trilho");
  const pontos = document.getElementById("carrossel-pontos");
  if (!carrossel || destaques.length === 0) return;

  trilho.innerHTML = destaques
    .map(
      (a, i) => `
      <a class="slide" href="detalhe.html?id=${a.id}"
         aria-label="${i + 1} de ${destaques.length}: ${a.nome}">
        <img src="${a.banner || a.imagem}" alt="${a.nome}">
        <div class="slide-texto">
          <h3>${a.nome}</h3>
          <p>${a.resumo}</p>
        </div>
      </a>`
    )
    .join("");

  pontos.innerHTML = destaques
    .map((_, i) => `<button class="ponto" data-i="${i}" aria-label="Ir para o destaque ${i + 1}"></button>`)
    .join("");

  let atual = 0;
  let timer = null;

  function irPara(i) {
    atual = (i + destaques.length) % destaques.length;
    trilho.style.transform = `translateX(-${atual * 100}%)`;
    pontos.querySelectorAll(".ponto").forEach((p, n) => p.classList.toggle("ativo", n === atual));
  }

  function iniciarAuto() {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzir || destaques.length < 2) return;
    pararAuto();
    timer = setInterval(() => irPara(atual + 1), 5000);
  }
  function pararAuto() {
    clearInterval(timer);
  }

  document.getElementById("seta-anterior").addEventListener("click", () => irPara(atual - 1));
  document.getElementById("seta-proxima").addEventListener("click", () => irPara(atual + 1));
  pontos.addEventListener("click", (e) => {
    if (e.target.dataset.i !== undefined) irPara(Number(e.target.dataset.i));
  });

  carrossel.addEventListener("mouseenter", pararAuto);
  carrossel.addEventListener("mouseleave", iniciarAuto);
  carrossel.addEventListener("focusin", pararAuto);
  carrossel.addEventListener("focusout", iniciarAuto);

  // Deslizar o dedo no celular
  let inicioX = 0;
  carrossel.addEventListener("touchstart", (e) => (inicioX = e.touches[0].clientX), { passive: true });
  carrossel.addEventListener("touchend", (e) => {
    const diferenca = e.changedTouches[0].clientX - inicioX;
    if (Math.abs(diferenca) > 50) irPara(atual + (diferenca < 0 ? 1 : -1));
  });

  irPara(0);
  iniciarAuto();
}

/* =========================================================
   Tela 2: detalhe.html
   ========================================================= */
async function iniciarDetalhe() {
  const container = document.getElementById("detalhe-artista");
  if (!container) return; // não estamos na detalhe

  // Na página de detalhe, buscar leva para a home já filtrada
  configurarBusca((termo) => {
    window.location.href = termo ? `index.html?busca=${encodeURIComponent(termo)}` : "index.html";
  });

  const id = Number(new URLSearchParams(window.location.search).get("id"));

  let artistas;
  try {
    artistas = await carregarDados();
  } catch (erro) {
    container.innerHTML =
      '<p class="mensagem">Não foi possível carregar os dados. Abra o site por um servidor local (Live Server).</p>';
    console.error(erro);
    return;
  }

  const artista = artistas.find((a) => a.id === id);
  if (!artista) {
    container.innerHTML =
      '<p class="mensagem">Artista não encontrado. <a href="index.html">Voltar para a página inicial</a>.</p>';
    return;
  }

  document.title = `${artista.nome} | Acervo Musical`;

  // Informações gerais: cada artista tem a sua própria lista "info" no JSON
  container.innerHTML = `
    <div class="detalhe">
      <img class="detalhe-foto" src="${artista.imagem}" alt="${artista.nome}">
      <div class="detalhe-painel">
        <h1>${artista.nome}</h1>
        <p class="detalhe-resumo">${artista.resumo}</p>
        <dl class="info-lista">
          ${artista.info
            .map((item) => `<div><dt>${item.rotulo}</dt><dd>${item.valor}</dd></div>`)
            .join("")}
        </dl>
      </div>
    </div>`;

  // Álbuns (entidade secundária)
  const faixa = document.getElementById("galeria-faixa");
  faixa.innerHTML = artista.albuns
    .map(
      (al) => `
      <article class="albumCard">
        <img src="${al.imagem}" alt="Capa do álbum ${al.titulo}" loading="lazy">
        <h3>${al.titulo}</h3>
        ${al.ano ? `<p>${al.ano}</p>` : ""}
      </article>`
    )
    .join("");

  document.getElementById("galeria-proxima").addEventListener("click", () => {
    faixa.scrollBy({ left: faixa.clientWidth * 0.8, behavior: "smooth" });
  });
}

iniciarHome();
iniciarDetalhe();