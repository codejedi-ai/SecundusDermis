"""Regression guards for catalog family parsing and grouping."""

from __future__ import annotations

from catalog_meta import (
    assign_family_prices,
    build_browse_summaries,
    build_family_detail,
    build_family_summaries,
    enrich_catalog_item,
    parse_stem_fields,
    price_for_family,
)


def test_price_for_family_is_stable_per_product_id():
    p1 = price_for_family("id_00000020", "Tees_Tanks")
    p2 = price_for_family("id_00000020", "Tees_Tanks")
    p3 = price_for_family("id_00000021", "Tees_Tanks")
    assert p1 == p2
    assert p1 != p3 or "id_00000021" == "id_00000020"


def test_assign_family_prices_same_across_variants():
    catalog = [
        enrich_catalog_item(
            {
                "product_id": "WOMEN-Tees_Tanks-id_00000020-04_1_front",
                "product_name": "Tee",
                "description": "",
                "gender": "WOMEN",
                "category": "Tees_Tanks",
                "price": 0,
                "image_url": "/a.jpg",
            },
            {"product_id": "id_00000020"},
        ),
        enrich_catalog_item(
            {
                "product_id": "WOMEN-Tees_Tanks-id_00000020-06_1_front",
                "product_name": "Tee",
                "description": "",
                "gender": "WOMEN",
                "category": "Tees_Tanks",
                "price": 0,
                "image_url": "/b.jpg",
            },
            {"product_id": "id_00000020"},
        ),
    ]
    assign_family_prices(catalog)
    assert catalog[0]["price"] == catalog[1]["price"]
    assert catalog[0]["price"] == price_for_family("id_00000020", "Tees_Tanks")


def test_parse_stem_fields_from_filename():
    stem = "WOMEN-Tees_Tanks-id_00000020-06_1_front"
    row = {
        "product_id": "id_00000020",
        "image_type": "front",
        "gender": "WOMEN",
        "product_type": "Tees_Tanks",
    }
    fields = parse_stem_fields(stem, row)
    assert fields["family_id"] == "id_00000020"
    assert fields["look_variant"] == "06"
    assert fields["image_view"] == "front"


def test_build_family_summaries_groups_variants():
    catalog = [
        enrich_catalog_item(
            {
                "product_id": "WOMEN-Tees_Tanks-id_00000020-04_1_front",
                "product_name": "Tee A",
                "description": "cotton",
                "gender": "WOMEN",
                "category": "Tees_Tanks",
                "price": 20.0,
                "image_url": "/images/a.jpg",
            },
            {"product_id": "id_00000020", "image_type": "front"},
        ),
        enrich_catalog_item(
            {
                "product_id": "WOMEN-Tees_Tanks-id_00000020-06_1_front",
                "product_name": "Tee A",
                "description": "cotton",
                "gender": "WOMEN",
                "category": "Tees_Tanks",
                "price": 22.0,
                "image_url": "/images/b.jpg",
            },
            {"product_id": "id_00000020", "image_type": "front"},
        ),
    ]
    families = build_family_summaries(catalog)
    assert len(families) == 1
    assert families[0]["family_id"] == "id_00000020"
    assert families[0]["variant_count"] == 2
    assert set(families[0]["variants"]) == {"04", "06"}


def test_build_family_detail_views_per_variant():
    catalog = [
        enrich_catalog_item(
            {
                "product_id": "WOMEN-Tees_Tanks-id_00000020-06_1_front",
                "product_name": "Tee",
                "description": "d",
                "gender": "WOMEN",
                "category": "Tees_Tanks",
                "price": 20.0,
                "image_url": "/images/f.jpg",
            },
            {"product_id": "id_00000020"},
        ),
    ]
    detail = build_family_detail(
        catalog,
        family_id="id_00000020",
        gender="WOMEN",
        category="Tees_Tanks",
    )
    assert detail is not None
    assert detail["variants"][0]["variant"] == "06"
    assert detail["variants"][0]["views"][0]["product_id"].endswith("_front")


def test_browse_summaries_one_card_per_family_id_within_gender_filter():
    catalog = [
        enrich_catalog_item(
            {
                "product_id": "WOMEN-Blouses_Shirts-id_00000065-01_1_front",
                "product_name": "Blouse",
                "description": "",
                "gender": "WOMEN",
                "category": "Blouses_Shirts",
                "price": 10.0,
                "image_url": "/a.jpg",
            },
            {"product_id": "id_00000065"},
        ),
        enrich_catalog_item(
            {
                "product_id": "WOMEN-Pants-id_00000065-02_1_front",
                "product_name": "Pants",
                "description": "",
                "gender": "WOMEN",
                "category": "Pants",
                "price": 12.0,
                "image_url": "/b.jpg",
            },
            {"product_id": "id_00000065"},
        ),
    ]
    browse = build_browse_summaries(catalog, gender="WOMEN")
    assert len(browse) == 1
    assert browse[0]["family_id"] == "id_00000065"


def test_browse_summaries_respects_category_filter():
    catalog = [
        enrich_catalog_item(
            {
                "product_id": "WOMEN-Blouses_Shirts-id_00000065-01_1_front",
                "product_name": "Blouse",
                "description": "",
                "gender": "WOMEN",
                "category": "Blouses_Shirts",
                "price": 10.0,
                "image_url": "/a.jpg",
            },
            {"product_id": "id_00000065"},
        ),
        enrich_catalog_item(
            {
                "product_id": "WOMEN-Pants-id_00000065-02_1_front",
                "product_name": "Pants",
                "description": "",
                "gender": "WOMEN",
                "category": "Pants",
                "price": 12.0,
                "image_url": "/b.jpg",
            },
            {"product_id": "id_00000065"},
        ),
    ]
    browse = build_browse_summaries(catalog, gender="WOMEN", category="Pants")
    assert len(browse) == 1
    assert browse[0]["category"] == "Pants"


def test_same_family_id_different_category_stays_separate():
    catalog = [
        enrich_catalog_item(
            {
                "product_id": "MEN-Jackets_Vests-id_00000094-01_1_front",
                "product_name": "Jacket",
                "description": "",
                "gender": "MEN",
                "category": "Jackets_Vests",
                "price": 10.0,
                "image_url": "/a.jpg",
            },
            {"product_id": "id_00000094"},
        ),
        enrich_catalog_item(
            {
                "product_id": "MEN-Suiting-id_00000094-01_1_front",
                "product_name": "Suit",
                "description": "",
                "gender": "MEN",
                "category": "Suiting",
                "price": 99.0,
                "image_url": "/b.jpg",
            },
            {"product_id": "id_00000094"},
        ),
    ]
    assert len(build_family_summaries(catalog)) == 2
