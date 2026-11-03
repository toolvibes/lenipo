from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.estimate_card import EstimateCard
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.estimation_votes_item import EstimationVotesItem
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="Estimation")



@_attrs_define
class Estimation:
    """ 
        Attributes:
            started_by (None | UserRef):
            started_at (datetime.datetime):
            revealed (bool):
            votes (list[EstimationVotesItem]):
            mine (EstimateCard | None):
            can_manage (bool):
     """

    started_by: None | UserRef
    started_at: datetime.datetime
    revealed: bool
    votes: list[EstimationVotesItem]
    mine: EstimateCard | None
    can_manage: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.estimation_votes_item import EstimationVotesItem # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        started_by: dict[str, Any] | None
        if isinstance(self.started_by, UserRef):
            started_by = self.started_by.to_dict()
        else:
            started_by = self.started_by

        started_at = self.started_at.isoformat()

        revealed = self.revealed

        votes = []
        for votes_item_data in self.votes:
            votes_item = votes_item_data.to_dict()
            votes.append(votes_item)



        mine: None | str
        if isinstance(self.mine, EstimateCard):
            mine = self.mine.value
        else:
            mine = self.mine

        can_manage = self.can_manage


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "startedBy": started_by,
            "startedAt": started_at,
            "revealed": revealed,
            "votes": votes,
            "mine": mine,
            "canManage": can_manage,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.estimation_votes_item import EstimationVotesItem # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        def _parse_started_by(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                started_by_type_0 = UserRef.from_dict(data)



                return started_by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        started_by = _parse_started_by(d.pop("startedBy"))


        started_at = datetime.datetime.fromisoformat(d.pop("startedAt"))




        revealed = d.pop("revealed")

        votes = []
        _votes = d.pop("votes")
        for votes_item_data in (_votes):
            votes_item = EstimationVotesItem.from_dict(votes_item_data)



            votes.append(votes_item)


        def _parse_mine(data: object) -> EstimateCard | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                mine_type_0 = EstimateCard(data)



                return mine_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EstimateCard | None, data)

        mine = _parse_mine(d.pop("mine"))


        can_manage = d.pop("canManage")

        estimation = cls(
            started_by=started_by,
            started_at=started_at,
            revealed=revealed,
            votes=votes,
            mine=mine,
            can_manage=can_manage,
        )

        return estimation

