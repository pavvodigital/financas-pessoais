from sqlalchemy.orm import Session
from app.models import Category, CategoryRule

DEFAULT_CATEGORIES = [
    {"name": "Alimentação", "color": "#e9c46a", "icon": "🍔", "keywords": [
        "SUPERMERCAD", "PAO", "PADARIA", "RESTAUR", "ALIMENT", "LANCHE",
        "BOTECO", "BAR DO", "ESPETINHO", "MORI MORI", "FRIGOR",
    ]},
    {"name": "Transporte", "color": "#4caf82", "icon": "🚗", "keywords": [
        "UBER", "DL*UBER", "DL *UBER", "POSTO", "COMBUSTIV", "ESTACION",
    ]},
    {"name": "Moradia", "color": "#7c6af7", "icon": "🏠", "keywords": [
        "ALUGUEL", "CONDOMIN", "AGUA", "SANEAM",
    ]},
    {"name": "Saúde", "color": "#f08080", "icon": "🏥", "keywords": [
        "FARMACIA", "DROGARIA", "CLINICA", "MEDIC", "HOSPITAL",
    ]},
    {"name": "Educação", "color": "#87ceeb", "icon": "📚", "keywords": [
        "ESCOLA", "FACULDAD", "CURSO", "UDEMY", "LIVRO",
    ]},
    {"name": "Lazer", "color": "#dda0dd", "icon": "🎭", "keywords": [
        "CINEMA", "TEATRO", "SHOW", "SPOTIFY", "NETFLIX", "STEAM",
    ]},
    {"name": "Vestuário", "color": "#ffa07a", "icon": "👗", "keywords": [
        "VESTUARIO", "ROUPA", "CALCADO",
    ]},
    {"name": "Telecomunicações", "color": "#20b2aa", "icon": "📱", "keywords": [
        "TIM CELU", "VIVO", "CLARO", "OI TELEF",
    ]},
    {"name": "Energia", "color": "#ffd700", "icon": "⚡", "keywords": [
        "CEMIG DISTR", "INT /CEMIG", "CEMIG",
    ]},
    {"name": "Serviços & Seguros", "color": "#778899", "icon": "🔒", "keywords": [
        "SEGURO", "BRADESCO SEG", "PAY2ALL",
    ]},
    {"name": "Investimentos", "color": "#32cd32", "icon": "📈", "keywords": [
        "REND PAGO APLIC", "APLIC AUT",
    ]},
    {"name": "Renda", "color": "#00ced1", "icon": "💰", "keywords": [
        "REMUNERACAO", "SALARIO",
    ]},
    {"name": "Transferências", "color": "#b0c4de", "icon": "🔄", "keywords": [
        "PIX TRANSF",
    ]},
    {"name": "Outros", "color": "#808080", "icon": "❓", "keywords": []},
]

def seed_categories(db: Session) -> None:
    if db.query(Category).count() > 0:
        return
    priority = 100
    for cat_data in DEFAULT_CATEGORIES:
        cat = Category(name=cat_data["name"], color=cat_data["color"], icon=cat_data["icon"])
        db.add(cat)
        db.flush()
        for kw in cat_data["keywords"]:
            rule = CategoryRule(
                category_id=cat.id,
                keyword=kw.upper(),
                match_type="contains",
                priority=priority,
            )
            db.add(rule)
            priority -= 1
    db.commit()
