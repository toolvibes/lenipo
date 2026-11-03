from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.velocity_estimation import VelocityEstimation
from typing import cast

if TYPE_CHECKING:
  from ..models.velocity_sprints_item import VelocitySprintsItem





T = TypeVar("T", bound="Velocity")



@_attrs_define
class Velocity:
    """ 
        Attributes:
            estimation (VelocityEstimation):
            sprints (list[VelocitySprintsItem]):
     """

    estimation: VelocityEstimation
    sprints: list[VelocitySprintsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.velocity_sprints_item import VelocitySprintsItem # noqa: PLC0415
        estimation = self.estimation.value

        sprints = []
        for sprints_item_data in self.sprints:
            sprints_item = sprints_item_data.to_dict()
            sprints.append(sprints_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "estimation": estimation,
            "sprints": sprints,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.velocity_sprints_item import VelocitySprintsItem # noqa: PLC0415
        d = dict(src_dict)
        estimation = VelocityEstimation(d.pop("estimation"))




        sprints = []
        _sprints = d.pop("sprints")
        for sprints_item_data in (_sprints):
            sprints_item = VelocitySprintsItem.from_dict(sprints_item_data)



            sprints.append(sprints_item)


        velocity = cls(
            estimation=estimation,
            sprints=sprints,
        )

        return velocity

