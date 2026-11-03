from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.sprint import Sprint





T = TypeVar("T", bound="VelocitySprintsItem")



@_attrs_define
class VelocitySprintsItem:
    """ 
        Attributes:
            sprint (Sprint):
            committed (float):
            completed (float):
     """

    sprint: Sprint
    committed: float
    completed: float





    def to_dict(self) -> dict[str, Any]:
        from ..models.sprint import Sprint # noqa: PLC0415
        sprint = self.sprint.to_dict()

        committed = self.committed

        completed = self.completed


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "sprint": sprint,
            "committed": committed,
            "completed": completed,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sprint import Sprint # noqa: PLC0415
        d = dict(src_dict)
        sprint = Sprint.from_dict(d.pop("sprint"))




        committed = d.pop("committed")

        completed = d.pop("completed")

        velocity_sprints_item = cls(
            sprint=sprint,
            committed=committed,
            completed=completed,
        )

        return velocity_sprints_item

