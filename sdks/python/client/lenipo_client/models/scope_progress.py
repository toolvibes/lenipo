from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.scope_progress_estimation import ScopeProgressEstimation
from typing import cast

if TYPE_CHECKING:
  from ..models.scope_progress_sprints_item import ScopeProgressSprintsItem





T = TypeVar("T", bound="ScopeProgress")



@_attrs_define
class ScopeProgress:
    """ 
        Attributes:
            estimation (ScopeProgressEstimation):
            sprints (list[ScopeProgressSprintsItem]):
            scope (float):
            done (float):
            remaining (float):
            velocity (float):
            forecast_sprints (int | None):
     """

    estimation: ScopeProgressEstimation
    sprints: list[ScopeProgressSprintsItem]
    scope: float
    done: float
    remaining: float
    velocity: float
    forecast_sprints: int | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.scope_progress_sprints_item import ScopeProgressSprintsItem # noqa: PLC0415
        estimation = self.estimation.value

        sprints = []
        for sprints_item_data in self.sprints:
            sprints_item = sprints_item_data.to_dict()
            sprints.append(sprints_item)



        scope = self.scope

        done = self.done

        remaining = self.remaining

        velocity = self.velocity

        forecast_sprints: int | None
        forecast_sprints = self.forecast_sprints


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "estimation": estimation,
            "sprints": sprints,
            "scope": scope,
            "done": done,
            "remaining": remaining,
            "velocity": velocity,
            "forecastSprints": forecast_sprints,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.scope_progress_sprints_item import ScopeProgressSprintsItem # noqa: PLC0415
        d = dict(src_dict)
        estimation = ScopeProgressEstimation(d.pop("estimation"))




        sprints = []
        _sprints = d.pop("sprints")
        for sprints_item_data in (_sprints):
            sprints_item = ScopeProgressSprintsItem.from_dict(sprints_item_data)



            sprints.append(sprints_item)


        scope = d.pop("scope")

        done = d.pop("done")

        remaining = d.pop("remaining")

        velocity = d.pop("velocity")

        def _parse_forecast_sprints(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        forecast_sprints = _parse_forecast_sprints(d.pop("forecastSprints"))


        scope_progress = cls(
            estimation=estimation,
            sprints=sprints,
            scope=scope,
            done=done,
            remaining=remaining,
            velocity=velocity,
            forecast_sprints=forecast_sprints,
        )

        return scope_progress

