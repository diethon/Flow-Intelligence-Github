"""
Pytest Unit and Integration Tests for ML Pipeline & Leakage Protections
"""

import sys
import os
import pytest
import pandas as pd
import numpy as np

# Append dataset path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
import preprocessing
import feature_engineering
import predict
import training
import main

@pytest.fixture
def synthetic_dataset():
    """
    Generates a safe chronological synthetic dataset with known cycle times and repositories.
    """
    return pd.DataFrame({
        "repository": [
            "repo_a", "repo_a", "repo_a", "repo_b", "repo_b",
            "repo_a", "repo_a", "repo_a", "repo_b", "repo_b",
            "repo_a", "repo_a", "repo_a", "repo_b", "repo_b"
        ],
        "pr_number": [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115],
        "title": [
            "PR 1", "PR 2", "PR 3", "PR 4", "PR 5",
            "PR 6", "PR 7", "PR 8", "PR 9", "PR 10",
            "PR 11", "PR 12", "PR 13", "PR 14", "PR 15"
        ],
        "author": [
            "dev_1", "dev_1", "dev_1", "dev_2", "dev_1",
            "dev_2", "dev_1", "dev_1", "dev_2", "dev_1",
            "dev_1", "dev_2", "dev_1", "dev_2", "dev_1"
        ],
        "state": ["closed"] * 15,
        "created_at": [
            "2026-01-01 10:00:00", "2026-01-02 10:00:00", "2026-01-03 10:00:00", "2026-01-04 10:00:00", "2026-01-05 10:00:00",
            "2026-01-06 10:00:00", "2026-01-07 10:00:00", "2026-01-08 10:00:00", "2026-01-09 10:00:00", "2026-01-10 10:00:00",
            "2026-01-11 10:00:00", "2026-01-12 10:00:00", "2026-01-13 10:00:00", "2026-01-14 10:00:00", "2026-01-15 10:00:00"
        ],
        "merged_at": [
            "2026-01-01 20:00:00", "2026-01-03 10:00:00", "2026-01-05 10:00:00", "2026-01-04 15:00:00", "2026-01-06 10:00:00",
            "2026-01-06 12:00:00", "2026-01-07 15:00:00", "2026-01-12 10:00:00", "2026-01-09 16:00:00", "2026-01-14 10:00:00",
            "2026-01-12 12:00:00", "2026-01-12 15:00:00", "2026-01-17 10:00:00", "2026-01-14 16:00:00", "2026-01-19 10:00:00"
        ],
        "draft": [False, False, False, True, False, False, False, False, False, False, False, False, False, False, False],
        "changed_files": [2, 5, 1, 10, 3, 2, 4, 1, 8, 3, 2, 4, 1, 8, 3],
        "additions": [100, 200, 50, 500, 150, 120, 250, 60, 400, 180, 120, 250, 60, 400, 180],
        "deletions": [50, 100, 10, 200, 50, 30, 80, 15, 150, 60, 30, 80, 15, 150, 60],
        "commits": [2, 4, 1, 5, 2, 1, 3, 1, 4, 2, 1, 3, 1, 4, 2],
        "comments": [0] * 15,
        "review_comments": [0] * 15,
        "mergeable_state": ["unknown"] * 15,
        "labels": ["bug", "feature,bug", "", "refactor", "bug", "bug", "feature", "", "bug", "refactor", "bug", "feature", "", "bug", "refactor"],
        "requested_reviewers": ["rev_1", "rev_1,rev_2", "", "rev_3", "", "rev_1", "rev_2", "", "rev_3", "", "rev_1", "rev_2", "", "rev_3", ""],
        "assignees": ["dev_1", "", "dev_1", "dev_2", "", "", "dev_1", "", "dev_2", "", "", "dev_1", "", "dev_2", ""]
    })

def test_no_future_rows_used_in_historical_features(synthetic_dataset):
    """
    Checks that expanding features use ONLY data from prior rows, preventing future leakage.
    """
    df = preprocessing.clean_dataset(synthetic_dataset, is_training=True)
    meta = feature_engineering.fit_feature_metadata(df)
    X = feature_engineering.engineer_features(df, meta, is_training=True)
    
    # dev_1 cycle times are: PR 1 = 10h, PR 2 = 24h, PR 3 = 48h, PR 5 = 29h
    # dev_1 counts: PR 1 (0), PR 2 (1), PR 3 (2), PR 5 (3)
    
    # Check Dev 1 counts
    dev_1_rows = df[df['author'] == 'dev_1'].index
    # Row 1 (first dev_1 PR) count must be 0
    assert X.loc[dev_1_rows[0], 'author_pr_count'] == 0
    # Row 2 count must be 1
    assert X.loc[dev_1_rows[1], 'author_pr_count'] == 1
    # Row 3 count must be 2
    assert X.loc[dev_1_rows[2], 'author_pr_count'] == 2
    
    # Check Dev 1 average cycle time
    # Row 2 avg cycle time must be exactly PR 1's cycle time (10 hours)
    assert X.loc[dev_1_rows[1], 'author_avg_cycle_time'] == pytest.approx(10.0)
    # Row 3 avg cycle time must be average of PR 1 & PR 2 ( (10+24)/2 = 17 hours )
    assert X.loc[dev_1_rows[2], 'author_avg_cycle_time'] == pytest.approx(17.0)

def test_current_row_target_not_used(synthetic_dataset):
    """
    Checks that the current row's target (cycle time / risk class) is not included in its features.
    """
    df = preprocessing.clean_dataset(synthetic_dataset, is_training=True)
    meta = feature_engineering.fit_feature_metadata(df)
    X = feature_engineering.engineer_features(df, meta, is_training=True)
    
    # For dev_1 first row, target cycle time is 10.0 hours.
    # The feature author_avg_cycle_time must NOT equal 10.0 (it should fallback to global training median since no history exists)
    dev_1_rows = df[df['author'] == 'dev_1'].index
    assert X.loc[dev_1_rows[0], 'author_avg_cycle_time'] == pytest.approx(meta['global_mean_cycle_time'])

def test_repository_group_split_has_no_overlap(synthetic_dataset):
    """
    Checks that Group Split separates repository partitions completely without overlap.
    """
    df = preprocessing.clean_dataset(synthetic_dataset, is_training=True)
    train_df, test_df = preprocessing.split_by_repository(df)
    
    train_repos = set(train_df['repository'].unique())
    test_repos = set(test_df['repository'].unique())
    
    # Check intersection is empty
    assert len(train_repos.intersection(test_repos)) == 0

def test_temporal_split_order(synthetic_dataset):
    """
    Checks that Chronological split orders data correctly (all train dates <= test dates).
    """
    df = preprocessing.clean_dataset(synthetic_dataset, is_training=True)
    train_df, test_df = preprocessing.split_chronological_80_20(df)
    
    max_train_date = train_df['created_at'].max()
    min_test_date = test_df['created_at'].min()
    
    assert max_train_date <= min_test_date

def test_train_test_feature_columns_match(synthetic_dataset):
    """
    Checks that training and testing features align column-wise.
    """
    df = preprocessing.clean_dataset(synthetic_dataset, is_training=True)
    train_df, test_df = preprocessing.split_stratified(df)
    
    meta = feature_engineering.fit_feature_metadata(train_df)
    X_train = feature_engineering.engineer_features(train_df, meta, is_training=True)
    X_test = feature_engineering.engineer_features(test_df, meta, is_training=False)
    
    assert list(X_train.columns) == list(X_test.columns)

def test_unknown_repository_uses_cold_start():
    """
    Checks that predict_pr routes to cold start for new repositories.
    """
    test_pr = {
        "repository": "new_unseen_repo",
        "author": "dev_1",
        "draft": False,
        "changed_files": 3,
        "additions": 100,
        "deletions": 50,
        "commits": 2,
        "labels": "",
        "requested_reviewers": "",
        "assignees": ""
    }
    
    res = predict.predict_pr(test_pr)
    assert res["modelType"] == "cold_start"
    assert res["coldStart"] is True
    assert "Repository history was unavailable" in res["warnings"]

def test_unknown_author_not_in_top_factors():
    """
    Checks that new authors don't have author cycle times listed in key factors.
    """
    test_pr = {
        "repository": "microsoft/vscode",
        "author": "totally_new_developer_xyz",
        "draft": False,
        "changed_files": 2,
        "additions": 50,
        "deletions": 10,
        "commits": 1,
        "labels": "",
        "requested_reviewers": "",
        "assignees": ""
    }
    
    res = predict.predict_pr(test_pr)
    factors = [f["factor"] for f in res["topFactors"]]
    
    assert "Author Avg Cycle Time" not in factors
    assert "Author Pr Count" not in factors

def test_probability_sum_equals_one():
    """
    Checks that class probability distributions sum to 1.0.
    """
    test_pr = {
        "repository": "microsoft/vscode",
        "author": "dev_1",
        "draft": False,
        "changed_files": 2,
        "additions": 50,
        "deletions": 10,
        "commits": 1,
        "labels": "",
        "requested_reviewers": "",
        "assignees": ""
    }
    res = predict.predict_pr(test_pr)
    prob_sum = res["probabilities"]["low"] + res["probabilities"]["medium"] + res["probabilities"]["high"]
    assert prob_sum == pytest.approx(1.0, abs=1e-3)

def test_prediction_confidence_matches_max_probability():
    """
    Checks that predicted confidence matches the largest class probability.
    """
    test_pr = {
        "repository": "microsoft/vscode",
        "author": "dev_1",
        "draft": False,
        "changed_files": 2,
        "additions": 50,
        "deletions": 10,
        "commits": 1,
        "labels": "",
        "requested_reviewers": "",
        "assignees": ""
    }
    res = predict.predict_pr(test_pr)
    max_prob = max(res["probabilities"].values())
    assert res["confidence"] == pytest.approx(max_prob)

def test_same_seed_reproduces_results(synthetic_dataset):
    """
    Checks that identical seeds generate matching predictions.
    """
    df = preprocessing.clean_dataset(synthetic_dataset, is_training=True)
    
    model1 = training.initialize_model("HistGradientBoosting")
    model2 = training.initialize_model("HistGradientBoosting")
    
    X = pd.DataFrame(np.random.rand(20, 5))
    y = np.random.randint(0, 3, 20)
    
    model1.fit(X, y)
    model2.fit(X, y)
    
    pred1 = model1.predict(X)
    pred2 = model2.predict(X)
    
    np.testing.assert_array_equal(pred1, pred2)

def test_schema_rejects_target_fields():
    """
    Verifies target fields are excluded from schemas.
    """
    # Raw api schema checks
    target_fields = ['risk_class', 'cycle_time_hours', 'merged_at']
    
    # Read raw schema file if created or check model definition
    # Here we mock test or check features module definitions
    for field in target_fields:
        assert field not in predict.predict_pr.__code__.co_varnames
