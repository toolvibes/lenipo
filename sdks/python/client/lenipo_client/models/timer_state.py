from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.running_timer import RunningTimer





T = TypeVar("T", bound="TimerState")



@_attrs_define
class TimerState:
    """ 
        Attributes:
            timer (None | RunningTimer):
     """

    timer: None | RunningTimer





    def to_dict(self) -> dict[str, Any]:
        from ..models.running_timer import RunningTimer # noqa: PLC0415
        timer: dict[str, Any] | None
        if isinstance(self.timer, RunningTimer):
            timer = self.timer.to_dict()
        else:
            timer = self.timer


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "timer": timer,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.running_timer import RunningTimer # noqa: PLC0415
        d = dict(src_dict)
        def _parse_timer(data: object) -> None | RunningTimer:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                timer_type_0 = RunningTimer.from_dict(data)



                return timer_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | RunningTimer, data)

        timer = _parse_timer(d.pop("timer"))


        timer_state = cls(
            timer=timer,
        )

        return timer_state

