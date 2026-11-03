from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.sprint_state import SprintState
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.sprint_capacity import SprintCapacity





T = TypeVar("T", bound="Sprint")



@_attrs_define
class Sprint:
    """ 
        Attributes:
            id (UUID):
            board_id (UUID):
            name (str):
            goal (str):
            state (SprintState):
            start_date (datetime.date | None):
            end_date (datetime.date | None):
            started_at (datetime.datetime | None):
            completed_at (datetime.datetime | None):
            capacity (SprintCapacity):
     """

    id: UUID
    board_id: UUID
    name: str
    goal: str
    state: SprintState
    start_date: datetime.date | None
    end_date: datetime.date | None
    started_at: datetime.datetime | None
    completed_at: datetime.datetime | None
    capacity: SprintCapacity





    def to_dict(self) -> dict[str, Any]:
        from ..models.sprint_capacity import SprintCapacity # noqa: PLC0415
        id = str(self.id)

        board_id = str(self.board_id)

        name = self.name

        goal = self.goal

        state = self.state.value

        start_date: None | str
        if isinstance(self.start_date, datetime.date):
            start_date = self.start_date.isoformat()
        else:
            start_date = self.start_date

        end_date: None | str
        if isinstance(self.end_date, datetime.date):
            end_date = self.end_date.isoformat()
        else:
            end_date = self.end_date

        started_at: None | str
        if isinstance(self.started_at, datetime.datetime):
            started_at = self.started_at.isoformat()
        else:
            started_at = self.started_at

        completed_at: None | str
        if isinstance(self.completed_at, datetime.datetime):
            completed_at = self.completed_at.isoformat()
        else:
            completed_at = self.completed_at

        capacity = self.capacity.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "boardId": board_id,
            "name": name,
            "goal": goal,
            "state": state,
            "startDate": start_date,
            "endDate": end_date,
            "startedAt": started_at,
            "completedAt": completed_at,
            "capacity": capacity,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sprint_capacity import SprintCapacity # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        board_id = UUID(d.pop("boardId"))




        name = d.pop("name")

        goal = d.pop("goal")

        state = SprintState(d.pop("state"))




        def _parse_start_date(data: object) -> datetime.date | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                start_date_type_0 = datetime.date.fromisoformat(data)



                return start_date_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.date | None, data)

        start_date = _parse_start_date(d.pop("startDate"))


        def _parse_end_date(data: object) -> datetime.date | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                end_date_type_0 = datetime.date.fromisoformat(data)



                return end_date_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.date | None, data)

        end_date = _parse_end_date(d.pop("endDate"))


        def _parse_started_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                started_at_type_0 = datetime.datetime.fromisoformat(data)



                return started_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        started_at = _parse_started_at(d.pop("startedAt"))


        def _parse_completed_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                completed_at_type_0 = datetime.datetime.fromisoformat(data)



                return completed_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        completed_at = _parse_completed_at(d.pop("completedAt"))


        capacity = SprintCapacity.from_dict(d.pop("capacity"))




        sprint = cls(
            id=id,
            board_id=board_id,
            name=name,
            goal=goal,
            state=state,
            start_date=start_date,
            end_date=end_date,
            started_at=started_at,
            completed_at=completed_at,
            capacity=capacity,
        )

        return sprint

