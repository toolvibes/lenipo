from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.access_check_result_user import AccessCheckResultUser
  from ..models.access_check_step import AccessCheckStep





T = TypeVar("T", bound="AccessCheckResult")



@_attrs_define
class AccessCheckResult:
    """ 
        Attributes:
            user (AccessCheckResultUser):
            granted (bool):
            steps (list[AccessCheckStep]):
     """

    user: AccessCheckResultUser
    granted: bool
    steps: list[AccessCheckStep]





    def to_dict(self) -> dict[str, Any]:
        from ..models.access_check_result_user import AccessCheckResultUser # noqa: PLC0415
        from ..models.access_check_step import AccessCheckStep # noqa: PLC0415
        user = self.user.to_dict()

        granted = self.granted

        steps = []
        for steps_item_data in self.steps:
            steps_item = steps_item_data.to_dict()
            steps.append(steps_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "user": user,
            "granted": granted,
            "steps": steps,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.access_check_result_user import AccessCheckResultUser # noqa: PLC0415
        from ..models.access_check_step import AccessCheckStep # noqa: PLC0415
        d = dict(src_dict)
        user = AccessCheckResultUser.from_dict(d.pop("user"))




        granted = d.pop("granted")

        steps = []
        _steps = d.pop("steps")
        for steps_item_data in (_steps):
            steps_item = AccessCheckStep.from_dict(steps_item_data)



            steps.append(steps_item)


        access_check_result = cls(
            user=user,
            granted=granted,
            steps=steps,
        )

        return access_check_result

