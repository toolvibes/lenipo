from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="ProjectAgentSettingsReviewStatuses")



@_attrs_define
class ProjectAgentSettingsReviewStatuses:
    """ 
        Attributes:
            approved (None | UUID):
            changes_requested (None | UUID):
     """

    approved: None | UUID
    changes_requested: None | UUID





    def to_dict(self) -> dict[str, Any]:
        approved: None | str
        if isinstance(self.approved, UUID):
            approved = str(self.approved)
        else:
            approved = self.approved

        changes_requested: None | str
        if isinstance(self.changes_requested, UUID):
            changes_requested = str(self.changes_requested)
        else:
            changes_requested = self.changes_requested


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "approved": approved,
            "changesRequested": changes_requested,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_approved(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                approved_type_0 = UUID(data)



                return approved_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        approved = _parse_approved(d.pop("approved"))


        def _parse_changes_requested(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                changes_requested_type_0 = UUID(data)



                return changes_requested_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        changes_requested = _parse_changes_requested(d.pop("changesRequested"))


        project_agent_settings_review_statuses = cls(
            approved=approved,
            changes_requested=changes_requested,
        )

        return project_agent_settings_review_statuses

