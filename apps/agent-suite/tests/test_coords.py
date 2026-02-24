from packages.core.coords import normalize_point, denormalize_point, normalize_box, denormalize_box

def test_normalize_denormalize_identity_midpoint():
    w, h = 1920, 1080
    x_px, y_px = 960, 540
    x_n, y_n = normalize_point(x_px, y_px, w, h)
    x2, y2 = denormalize_point(x_n, y_n, w, h)
    assert 0 <= x_n <= 1000
    assert 0 <= y_n <= 1000
    # Should land very close to original midpoint (exact with our rounding)
    assert abs(x2 - x_px) <= 1
    assert abs(y2 - y_px) <= 1

def test_box_order_is_stable():
    w, h = 100, 100
    b = normalize_box(90, 90, 10, 10, w, h)
    assert b[0] <= b[2]
    assert b[1] <= b[3]
    px = denormalize_box(*b, w, h)
    assert px[0] <= px[2]
    assert px[1] <= px[3]

    p = normalize_point(-10, -10, w, h)
    assert p[0] >= 0 and p[1] >= 0

    p = normalize_point(1500, 1500, w, h)
    assert p[0] <= 1000 and p[1] <= 1000
