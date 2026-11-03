from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ReleaseProgress")



@_attrs_define
class ReleaseProgress:
    """ 
        Attributes:
            issues (int):
            done (int):
            points (float):
            done_points (float):
     """

    issues: int
    done: int
    points: float
    done_points: float





    def to_dict(self) -> dict[str, Any]:
        issues = self.issues

        done = self.done

        points = self.points

        done_points = self.done_points


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issues": issues,
            "done": done,
            "points": points,
            "donePoints": done_points,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        issues = d.pop("issues")

        done = d.pop("done")

        points = d.pop("points")

        done_points = d.pop("donePoints")

        release_progress = cls(
            issues=issues,
            done=done,
            points=points,
            done_points=done_points,
        )

        return release_progress

